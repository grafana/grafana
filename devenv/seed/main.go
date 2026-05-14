// Seed tool for replicating large-scale Grafana environments locally.
//
// Creates flat root folders, library elements, dashboards, and editor users
// via the Grafana HTTP API. Everything is fully idempotent – re-running resumes
// from where the previous run stopped.
//
// Usage:
//
//	go run ./devenv/seed \
//	  -url  https://localhost:3000 \
//	  -user admin -pass admin \
//	  -folders          2500 \
//	  -admin-only-folders 2000 \
//	  -dashboards       45000 \
//	  -library-elements  1000 \
//	  -lib-connections     20 \
//	  -users             1000 \
//	  -workers             50
//
// Folders 1..admin-only-folders are restricted to Admin only.
// The remaining folders get Editor + Viewer access, and library elements are
// placed exclusively in those public folders so non-admin users can find them.
package main

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

// ── CLI flags ─────────────────────────────────────────────────────────────────

var (
	grafanaURL = flag.String("url", "https://localhost:3000", "Grafana base URL")
	user       = flag.String("user", "admin", "Grafana admin username")
	pass       = flag.String("pass", "admin", "Grafana admin password")

	skipFolders     = flag.Bool("skip-folders", false, "Skip folder creation and permission setting")
	numFolders      = flag.Int("folders", 2500, "Number of flat root folders to create (0 = skip)")
	adminOnlyThresh = flag.Int("admin-only-folders", 2000, "Folders 1..N are Admin-only; the rest get Editor+Viewer access")

	numDashboards    = flag.Int("dashboards", 45000, "Number of dashboards to create (0 = skip)")
	numLibElements   = flag.Int("library-elements", 1000, "Number of library elements to create (0 = skip)")
	resetLibElements = flag.Bool("reset-lib-elements", false, "Move seeded library elements that are in admin-only folders to public folders (preserves dashboard connections)")
	libConnections   = flag.Int("lib-connections", 20, "How many dashboards each library element is connected to")
	numUsers         = flag.Int("users", 1000, "Number of Editor users to create (0 = skip)")

	workers    = flag.Int("workers", 50, "Number of concurrent API workers")
	orgID      = flag.Int("org-id", 1, "Grafana org ID")
	skipTLS    = flag.Bool("skip-tls", true, "Skip TLS certificate verification (self-signed certs)")
	numRetries = flag.Int("retries", 3, "Retry attempts per request on 5xx / network error")
)

// ── HTTP client ───────────────────────────────────────────────────────────────

func newClient() *http.Client {
	return &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig:     &tls.Config{InsecureSkipVerify: *skipTLS}, //nolint:gosec
			MaxIdleConnsPerHost: *workers + 10,
		},
	}
}

func doRequest(client *http.Client, method, path string, body []byte) ([]byte, int, error) {
	var r io.Reader
	if body != nil {
		r = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, *grafanaURL+path, r)
	if err != nil {
		return nil, 0, err
	}
	req.SetBasicAuth(*user, *pass)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Grafana-Org-Id", fmt.Sprintf("%d", *orgID))

	resp, err := client.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return b, resp.StatusCode, nil
}

func doWithRetry(client *http.Client, method, path string, body []byte) ([]byte, int, error) {
	var (
		rb     []byte
		status int
		err    error
	)
	for attempt := 0; attempt <= *numRetries; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
		}
		rb, status, err = doRequest(client, method, path, body)
		if err == nil && status < 500 {
			return rb, status, nil
		}
	}
	return rb, status, err
}

func runWorkers(jobs <-chan func(c *http.Client), n int) (errored int64) {
	var wg sync.WaitGroup
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := newClient()
			for fn := range jobs {
				fn(c)
			}
		}()
	}
	wg.Wait()
	return errored
}

// ── Folders (flat) ────────────────────────────────────────────────────────────

type folderNode struct {
	idx int    // 1-based; determines admin-only vs public
	uid string // deterministic: folder-NNNNN
}

func folderUID(n int) string   { return fmt.Sprintf("folder-%05d", n) }
func folderTitle(n int) string { return fmt.Sprintf("Folder %d", n) }

func (f folderNode) isAdminOnly() bool { return f.idx <= *adminOnlyThresh }

func buildFolderList(n int) []folderNode {
	nodes := make([]folderNode, n)
	for i := range nodes {
		nodes[i] = folderNode{idx: i + 1, uid: folderUID(i + 1)}
	}
	return nodes
}

func fetchExistingFolderUIDs(client *http.Client) (map[string]bool, error) {
	existing := make(map[string]bool)
	pageNum := 1
	const pageSize = 5000
	for {
		path := fmt.Sprintf("/api/search?type=dash-folder&limit=%d&page=%d", pageSize, pageNum)
		body, status, err := doWithRetry(client, "GET", path, nil)
		if err != nil {
			return nil, fmt.Errorf("GET %s: %w", path, err)
		}
		if status != 200 {
			return nil, fmt.Errorf("GET %s: status %d: %s", path, status, body)
		}
		var results []struct {
			UID string `json:"uid"`
		}
		if err := json.Unmarshal(body, &results); err != nil {
			return nil, fmt.Errorf("decode folder search: %w", err)
		}
		if len(results) == 0 {
			break
		}
		for _, r := range results {
			existing[r.UID] = true
		}
		if len(results) < pageSize {
			break
		}
		pageNum++
	}
	return existing, nil
}

func seedFolders(client *http.Client, folders []folderNode) error {
	log.Printf("Checking existing folders (%d total)…", len(folders))
	existingUIDs, err := fetchExistingFolderUIDs(client)
	if err != nil {
		return fmt.Errorf("fetch existing folders: %w", err)
	}

	var todo []folderNode
	for _, f := range folders {
		if !existingUIDs[f.uid] {
			todo = append(todo, f)
		}
	}
	log.Printf("Folders: %d already exist, %d to create.", len(folders)-len(todo), len(todo))

	if len(todo) > 0 {
		type payload struct {
			UID   string `json:"uid"`
			Title string `json:"title"`
		}

		ch := make(chan func(*http.Client), *workers*2)
		var wg sync.WaitGroup
		var errored, done int64

		for w := 0; w < *workers; w++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				c := newClient()
				for fn := range ch {
					fn(c)
				}
			}()
		}

		for _, node := range todo {
			f := node
			ch <- func(c *http.Client) {
				b, _ := json.Marshal(payload{UID: f.uid, Title: folderTitle(f.idx)})
				rb, status, err := doWithRetry(c, "POST", "/api/folders", b)
				if err != nil {
					log.Printf("ERROR folder %s: %v", f.uid, err)
					atomic.AddInt64(&errored, 1)
					return
				}
				if status != 200 && status != 409 && status != 412 {
					log.Printf("ERROR folder %s: status %d: %s", f.uid, status, rb)
					atomic.AddInt64(&errored, 1)
					return
				}
				cur := atomic.AddInt64(&done, 1)
				if cur%500 == 0 {
					log.Printf("  Folders: %d / %d", cur, len(todo))
				}
			}
		}
		close(ch)
		wg.Wait()

		if errored > 0 {
			return fmt.Errorf("%d folder(s) failed to create", errored)
		}
	}

	log.Printf("Setting folder permissions…")
	if err := applyFolderPermissions(client, folders); err != nil {
		log.Printf("WARNING: some folder permissions could not be set: %v", err)
	}
	return nil
}

func applyFolderPermissions(client *http.Client, tree []folderNode) error {
	type permItem struct {
		Role       string `json:"role,omitempty"`
		Permission int    `json:"permission"`
	}
	type permPayload struct {
		Items []permItem `json:"items"`
	}

	adminOnly := permPayload{Items: []permItem{
		{Role: "Admin", Permission: 4},
	}}
	public := permPayload{Items: []permItem{
		{Role: "Admin", Permission: 4},
		{Role: "Editor", Permission: 2},
		{Role: "Viewer", Permission: 1},
	}}

	adminOnlyBody, _ := json.Marshal(adminOnly)
	publicBody, _ := json.Marshal(public)

	ch := make(chan func(*http.Client), *workers*2)
	var wg sync.WaitGroup
	var errored int64
	var done int64

	for w := 0; w < *workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := newClient()
			for fn := range ch {
				fn(c)
			}
		}()
	}

	for _, node := range tree {
		n := node
		var body []byte
		if n.isAdminOnly() {
			body = adminOnlyBody
		} else {
			body = publicBody
		}
		ch <- func(c *http.Client) {
			path := fmt.Sprintf("/api/folders/%s/permissions", n.uid)
			rb, status, err := doWithRetry(c, "POST", path, body)
			if err != nil {
				log.Printf("ERROR perm %s: %v", n.uid, err)
				atomic.AddInt64(&errored, 1)
				return
			}
			if status != 200 {
				log.Printf("ERROR perm %s: status %d: %s", n.uid, status, rb)
				atomic.AddInt64(&errored, 1)
			}
			cur := atomic.AddInt64(&done, 1)
			if cur%500 == 0 {
				log.Printf("  Permissions: %d / %d", cur, len(tree))
			}
		}
	}
	close(ch)
	wg.Wait()

	log.Printf("Permissions done. %d / %d failed.", errored, len(tree))
	if errored > 0 {
		return fmt.Errorf("%d permission updates failed", errored)
	}
	return nil
}

// ── Users ─────────────────────────────────────────────────────────────────────

func seedUserLogin(n int) string { return fmt.Sprintf("seeduser-%05d", n) }

func fetchExistingUsers(client *http.Client) (map[int]bool, error) {
	existing := make(map[int]bool)
	pageNum := 1
	for {
		path := fmt.Sprintf("/api/users?perpage=1000&page=%d", pageNum)
		body, status, err := doWithRetry(client, "GET", path, nil)
		if err != nil {
			return nil, fmt.Errorf("GET %s: %w", path, err)
		}
		if status != 200 {
			return nil, fmt.Errorf("GET %s: status %d: %s", path, status, body)
		}
		var users []struct {
			Login string `json:"login"`
		}
		if err := json.Unmarshal(body, &users); err != nil {
			return nil, fmt.Errorf("decode users: %w", err)
		}
		if len(users) == 0 {
			break
		}
		for _, u := range users {
			var n int
			if _, err := fmt.Sscanf(u.Login, "seeduser-%d", &n); err == nil {
				existing[n] = true
			}
		}
		if len(users) < 1000 {
			break
		}
		pageNum++
	}
	return existing, nil
}

func createUser(client *http.Client, n int) error {
	login := seedUserLogin(n)
	type createPayload struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Login    string `json:"login"`
		Password string `json:"password"`
		OrgId    int    `json:"OrgId"`
	}
	b, _ := json.Marshal(createPayload{
		Name:     fmt.Sprintf("Seed User %d", n),
		Email:    fmt.Sprintf("%s@seed.local", login),
		Login:    login,
		Password: "GrafanaSeed1!",
		OrgId:    *orgID,
	})

	rb, status, err := doWithRetry(client, "POST", "/api/admin/users", b)
	if err != nil {
		return fmt.Errorf("user %d: %w", n, err)
	}
	if status == 409 || status == 412 {
		return nil // already exists
	}
	if status != 200 {
		return fmt.Errorf("user %d: status %d: %s", n, status, rb)
	}

	// Parse the returned user ID and promote to Editor.
	var resp struct {
		ID int64 `json:"id"`
	}
	if err := json.Unmarshal(rb, &resp); err != nil || resp.ID == 0 {
		return nil // created but couldn't parse ID; role stays Viewer
	}

	type rolePayload struct {
		Role string `json:"role"`
	}
	roleBody, _ := json.Marshal(rolePayload{Role: "Editor"})
	rolePath := fmt.Sprintf("/api/org/users/%d", resp.ID)
	if _, rs, err := doWithRetry(client, "PATCH", rolePath, roleBody); err != nil || rs >= 300 {
		log.Printf("WARNING: could not set Editor role for user %d (status=%d): %v", n, rs, err)
	}
	return nil
}

func seedUsers(client *http.Client) error {
	log.Printf("Checking existing users…")
	existing, err := fetchExistingUsers(client)
	if err != nil {
		return fmt.Errorf("fetch existing users: %w", err)
	}

	todo := make([]int, 0, *numUsers)
	for n := 1; n <= *numUsers; n++ {
		if !existing[n] {
			todo = append(todo, n)
		}
	}
	log.Printf("Users: %d already exist, %d to create.", len(existing), len(todo))
	if len(todo) == 0 {
		return nil
	}

	ch := make(chan func(*http.Client), *workers*2)
	var wg sync.WaitGroup
	var errored, done int64

	for w := 0; w < *workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := newClient()
			for fn := range ch {
				fn(c)
			}
		}()
	}

	for _, idx := range todo {
		n := idx
		ch <- func(c *http.Client) {
			if err := createUser(c, n); err != nil {
				log.Printf("ERROR %v", err)
				atomic.AddInt64(&errored, 1)
			}
			cur := atomic.AddInt64(&done, 1)
			if cur%100 == 0 {
				log.Printf("Users: %d / %d", cur, len(todo))
			}
		}
	}
	close(ch)
	wg.Wait()

	log.Printf("Users done. Created %d, %d errors.", int64(len(todo))-errored, errored)
	return nil
}

// ── Library elements ──────────────────────────────────────────────────────────

type libPanelRef struct {
	UID  string
	Name string
}

func libPanelUID(n int) string  { return fmt.Sprintf("lib-panel-%04d", n) }
func libPanelName(n int) string { return fmt.Sprintf("Library Panel %d", n) }

func fetchExistingLibElements(client *http.Client) (map[int]bool, error) {
	existing := make(map[int]bool)
	pageNum := 1
	for {
		path := fmt.Sprintf("/api/library-elements?perPage=1000&page=%d", pageNum)
		body, status, err := doWithRetry(client, "GET", path, nil)
		if err != nil {
			return nil, fmt.Errorf("GET %s: %w", path, err)
		}
		if status != 200 {
			return nil, fmt.Errorf("GET %s: status %d: %s", path, status, body)
		}
		var resp struct {
			Result struct {
				Elements []struct {
					UID string `json:"uid"`
				} `json:"elements"`
			} `json:"result"`
		}
		if err := json.Unmarshal(body, &resp); err != nil {
			return nil, fmt.Errorf("decode library elements: %w", err)
		}
		if len(resp.Result.Elements) == 0 {
			break
		}
		for _, el := range resp.Result.Elements {
			var n int
			if _, err := fmt.Sscanf(el.UID, "lib-panel-%d", &n); err == nil {
				existing[n] = true
			}
		}
		pageNum++
	}
	return existing, nil
}

// relocateLibraryElements moves all seeded library elements that sit in
// admin-only folders into public folders by PATCHing their folderUid.
// This preserves all existing dashboard connections — there is no REST API
// to delete individual connections, so delete+recreate is not viable.
// relocateLibraryElements moves seeded library elements that are in admin-only
// folders into public folders (f3-01611…f3-02100) where Editor and Viewer
// users have explicit RBAC grants.
func relocateLibraryElements(client *http.Client, publicFolders []folderNode) error {
	log.Printf("Fetching seeded library elements to relocate to public folders…")

	type element struct {
		UID       string          `json:"uid"`
		Name      string          `json:"name"`
		Kind      int             `json:"kind"`
		Model     json.RawMessage `json:"model"`
		FolderUID string          `json:"folderUid"`
		Version   int64           `json:"version"`
	}

	var all []element
	pageNum := 1
	for {
		path := fmt.Sprintf("/api/library-elements?perPage=1000&page=%d", pageNum)
		body, status, err := doWithRetry(client, "GET", path, nil)
		if err != nil {
			return fmt.Errorf("GET %s: %w", path, err)
		}
		if status != 200 {
			return fmt.Errorf("GET %s: status %d: %s", path, status, body)
		}
		var resp struct {
			Result struct {
				Elements []element `json:"elements"`
			} `json:"result"`
		}
		if err := json.Unmarshal(body, &resp); err != nil {
			return fmt.Errorf("decode library elements: %w", err)
		}
		if len(resp.Result.Elements) == 0 {
			break
		}
		for _, el := range resp.Result.Elements {
			var n int
			if _, err := fmt.Sscanf(el.UID, "lib-panel-%d", &n); err == nil {
				all = append(all, el)
			}
		}
		pageNum++
	}

	if len(all) == 0 {
		log.Printf("No seeded library elements found.")
		return nil
	}

	// Build a set of public folder UIDs for quick lookup.
	publicSet := make(map[string]bool, len(publicFolders))
	for _, f := range publicFolders {
		publicSet[f.uid] = true
	}

	var todo []element
	for _, el := range all {
		if !publicSet[el.FolderUID] {
			todo = append(todo, el)
		}
	}
	log.Printf("Library elements: %d total, %d already in public folders, %d to relocate.",
		len(all), len(all)-len(todo), len(todo))
	if len(todo) == 0 {
		return nil
	}

	type patchPayload struct {
		FolderUID string          `json:"folderUid"`
		Kind      int             `json:"kind"`
		Name      string          `json:"name"`
		Model     json.RawMessage `json:"model"`
		Version   int64           `json:"version"`
	}

	ch := make(chan func(*http.Client), *workers*2)
	var wg sync.WaitGroup
	var errored, done int64

	for w := 0; w < *workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := newClient()
			for fn := range ch {
				fn(c)
			}
		}()
	}

	for i, item := range todo {
		el := item
		targetFolder := publicFolders[i%len(publicFolders)].uid
		ch <- func(c *http.Client) {
			b, _ := json.Marshal(patchPayload{
				FolderUID: targetFolder,
				Kind:      el.Kind,
				Name:      el.Name,
				Model:     el.Model,
				Version:   el.Version,
			})
			path := fmt.Sprintf("/api/library-elements/%s", el.UID)
			rb, status, err := doWithRetry(c, "PATCH", path, b)
			if err != nil || status != 200 {
				log.Printf("ERROR relocate %s → %s: status=%d %v: %s", el.UID, targetFolder, status, err, rb)
				atomic.AddInt64(&errored, 1)
				return
			}
			cur := atomic.AddInt64(&done, 1)
			if cur%100 == 0 {
				log.Printf("Relocated: %d / %d", cur, len(todo))
			}
		}
	}
	close(ch)
	wg.Wait()

	log.Printf("Relocated %d library element(s), %d error(s).", int64(len(todo))-errored, errored)
	if errored > 0 {
		return fmt.Errorf("%d relocation(s) failed", errored)
	}
	return nil
}

func seedLibraryElements(client *http.Client, folders []folderNode, publicFolders []folderNode) ([]libPanelRef, error) {
	refs := make([]libPanelRef, *numLibElements)
	for i := range refs {
		refs[i] = libPanelRef{UID: libPanelUID(i + 1), Name: libPanelName(i + 1)}
	}

	log.Printf("Checking existing library elements…")
	existing, err := fetchExistingLibElements(client)
	if err != nil {
		return nil, err
	}

	todo := make([]int, 0, *numLibElements)
	for n := 1; n <= *numLibElements; n++ {
		if !existing[n] {
			todo = append(todo, n)
		}
	}
	log.Printf("Library elements: %d already exist, %d to create.", len(existing), len(todo))
	if len(todo) == 0 {
		return refs, nil
	}

	log.Printf("Distributing library elements across %d public folder(s).", len(publicFolders))

	type payload struct {
		Name      string          `json:"name"`
		UID       string          `json:"uid"`
		FolderUID string          `json:"folderUid"`
		Kind      int             `json:"kind"`
		Model     json.RawMessage `json:"model"`
	}

	ch := make(chan func(*http.Client), *workers*2)
	var wg sync.WaitGroup
	var errored, done int64

	for w := 0; w < *workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := newClient()
			for fn := range ch {
				fn(c)
			}
		}()
	}

	for _, idx := range todo {
		n := idx
		folderUID := publicFolders[(n-1)%len(publicFolders)].uid
		ch <- func(c *http.Client) {
			name := libPanelName(n)
			model := json.RawMessage(fmt.Sprintf(
				`{"type":"text","title":%q,"description":"Seeded library panel %d","options":{"content":"panel %d"}}`,
				name, n, n,
			))
			b, _ := json.Marshal(payload{
				Name: name, UID: libPanelUID(n), FolderUID: folderUID, Kind: 1, Model: model,
			})
			rb, status, err := doWithRetry(c, "POST", "/api/library-elements", b)
			if err != nil || status != 200 {
				log.Printf("ERROR library element %d: status=%d %v: %s", n, status, err, rb)
				atomic.AddInt64(&errored, 1)
				return
			}
			cur := atomic.AddInt64(&done, 1)
			if cur%100 == 0 {
				log.Printf("Library elements: %d / %d", cur, len(todo))
			}
		}
	}
	close(ch)
	wg.Wait()

	log.Printf("Library elements done. Created %d, %d errors.", int64(len(todo))-errored, errored)
	return refs, nil
}

// ── Dashboards ────────────────────────────────────────────────────────────────

func fetchExistingDashboards(client *http.Client) (map[int]bool, error) {
	existing := make(map[int]bool)
	pageNum := 1
	const pageSize = 5000
	for {
		path := fmt.Sprintf("/api/search?type=dash-db&tag=seeded&limit=%d&page=%d", pageSize, pageNum)
		body, status, err := doWithRetry(client, "GET", path, nil)
		if err != nil {
			return nil, fmt.Errorf("GET %s: %w", path, err)
		}
		if status != 200 {
			return nil, fmt.Errorf("GET %s: status %d: %s", path, status, body)
		}
		var results []struct {
			UID string `json:"uid"`
		}
		if err := json.Unmarshal(body, &results); err != nil {
			return nil, fmt.Errorf("decode dashboard search: %w", err)
		}
		if len(results) == 0 {
			break
		}
		for _, r := range results {
			var n int
			if _, err := fmt.Sscanf(r.UID, "dash-%d", &n); err == nil {
				existing[n] = true
			}
		}
		if len(results) < pageSize {
			break
		}
		pageNum++
	}
	return existing, nil
}

// assignLibRef maps dashboard index n to a library element ref, or nil.
// Each lib element is connected to libConnections consecutive dashboards.
func assignLibRef(n int, refs []libPanelRef) *libPanelRef {
	if len(refs) == 0 || *libConnections <= 0 {
		return nil
	}
	idx := n - 1
	total := len(refs) * *libConnections
	if idx >= total {
		return nil
	}
	return &refs[idx / *libConnections]
}

func seedDashboards(client *http.Client, folders []folderNode, libRefs []libPanelRef) error {
	log.Printf("Checking existing dashboards…")
	existing, err := fetchExistingDashboards(client)
	if err != nil {
		return fmt.Errorf("fetch existing dashboards: %w", err)
	}

	todo := make([]int, 0, *numDashboards)
	for n := 1; n <= *numDashboards; n++ {
		if !existing[n] {
			todo = append(todo, n)
		}
	}
	log.Printf("Dashboards: %d already exist, %d to create.", len(existing), len(todo))
	if len(todo) == 0 {
		return nil
	}

	type dashPayload struct {
		Dashboard map[string]any `json:"dashboard"`
		FolderUID string         `json:"folderUid"`
		Overwrite bool           `json:"overwrite"`
		Message   string         `json:"message"`
	}

	ch := make(chan func(*http.Client), *workers*2)
	var wg sync.WaitGroup
	var errored, done int64

	for w := 0; w < *workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			c := newClient()
			for fn := range ch {
				fn(c)
			}
		}()
	}

	start := time.Now()

	for _, idx := range todo {
		n := idx
		folderUID := folders[(n-1)%len(folders)].uid
		libRef := assignLibRef(n, libRefs)

		ch <- func(c *http.Client) {
			uid := fmt.Sprintf("dash-%06d", n)
			panels := []any{}
			if libRef != nil {
				panels = append(panels, map[string]any{
					"id":      1,
					"type":    "text",
					"title":   libRef.Name,
					"gridPos": map[string]any{"h": 8, "w": 12, "x": 0, "y": 0},
					"libraryPanel": map[string]any{
						"uid":  libRef.UID,
						"name": libRef.Name,
					},
				})
			}
			b, _ := json.Marshal(dashPayload{
				Dashboard: map[string]any{
					"title": fmt.Sprintf("Dashboard %d", n), "uid": uid,
					"panels": panels, "schemaVersion": 36, "version": 0,
					"tags": []string{"seeded"},
				},
				FolderUID: folderUID, Overwrite: false, Message: "seeded",
			})
			rb, status, err := doWithRetry(c, "POST", "/api/dashboards/db", b)
			if err != nil || (status != 200 && status != 412) {
				log.Printf("ERROR dashboard %d: status=%d %v: %s", n, status, err, rb)
				atomic.AddInt64(&errored, 1)
				return
			}
			cur := atomic.AddInt64(&done, 1)
			if cur%1000 == 0 {
				log.Printf("Dashboards: %d / %d", cur, len(todo))
			}
		}
	}
	close(ch)
	wg.Wait()

	elapsed := time.Since(start).Round(time.Second)
	log.Printf("Dashboards done in %s. Created %d, %d errors.",
		elapsed, int64(len(todo))-errored, errored)
	return nil
}

// ── Main ──────────────────────────────────────────────────────────────────────

func main() {
	flag.Parse()

	client := newClient()
	var err error

	if _, status, healthErr := doWithRetry(client, "GET", "/api/health", nil); healthErr != nil || status != 200 {
		log.Fatalf("Cannot reach Grafana at %s (status=%d err=%v).", *grafanaURL, status, healthErr)
	}

	// Build the flat folder list in memory.
	folders := buildFolderList(*numFolders)
	adminOnly := 0
	for _, f := range folders {
		if f.isAdminOnly() {
			adminOnly++
		}
	}
	log.Printf("Folders: %d total (%d admin-only, %d public).",
		len(folders), adminOnly, len(folders)-adminOnly)

	// Phase 0 – folders + permissions
	if !*skipFolders && *numFolders > 0 {
		if err := seedFolders(client, folders); err != nil {
			log.Fatalf("seed folders: %v", err)
		}
	}

	// Phase 1 – users
	if *numUsers > 0 {
		if err := seedUsers(client); err != nil {
			log.Fatalf("seed users: %v", err)
		}
	}

	// Compute public folders — library elements live here so non-admin users can find them.
	publicFolders := make([]folderNode, 0, len(folders))
	for _, f := range folders {
		if !f.isAdminOnly() {
			publicFolders = append(publicFolders, f)
		}
	}
	if len(publicFolders) == 0 {
		log.Printf("WARNING: no public folders; library elements will land in admin-only folders.")
		publicFolders = folders
	}

	// Phase 2 – library elements (must precede dashboards)
	var libRefs []libPanelRef
	if *numLibElements > 0 {
		if *resetLibElements {
			if err := relocateLibraryElements(client, publicFolders); err != nil {
				log.Fatalf("relocate library elements: %v", err)
			}
		}
		libRefs, err = seedLibraryElements(client, folders, publicFolders)
		if err != nil {
			log.Fatalf("seed library elements: %v", err)
		}
		connected := min(*numDashboards, *numLibElements**libConnections)
		log.Printf("%d dashboards will reference a library element (%d × %d connections).",
			connected, *numLibElements, *libConnections)
	}

	// Phase 3 – dashboards
	if *numDashboards > 0 {
		if err := seedDashboards(client, folders, libRefs); err != nil {
			log.Fatalf("seed dashboards: %v", err)
		}
	}

	log.Printf("All done.")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
