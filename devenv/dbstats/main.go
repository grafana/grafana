// dbstats prints database statistics for a Grafana MySQL database:
// row counts for key tables, index definitions, and suggested seed-tool flags
// to replicate the scale in another environment.
//
// Usage:
//
//	go run ./devenv/dbstats -dsn "admin:secret@tcp(localhost:3306)/grafana"
//	go run ./devenv/dbstats -dsn "..." -seed-flags   # print seed flags only
package main

import (
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"
	"text/tabwriter"

	_ "github.com/go-sql-driver/mysql"
)

var (
	dsn       = flag.String("dsn", "", `MySQL DSN  e.g. admin:password@tcp(127.0.0.1:3306)/grafana`)
	seedFlags = flag.Bool("seed-flags", false, "Print suggested go run ./devenv/seed flags and exit")
)

func main() {
	flag.Parse()

	if *dsn == "" {
		fmt.Fprintln(os.Stderr, "Usage: go run ./devenv/dbstats -dsn \"user:pass@tcp(host:port)/dbname\"")
		flag.PrintDefaults()
		os.Exit(1)
	}

	db, err := sql.Open("mysql", *dsn)
	if err != nil {
		log.Fatalf("open: %v", err)
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		log.Fatalf("ping: %v", err)
	}

	if *seedFlags {
		printSeedFlags(db)
		return
	}

	printRowCounts(db)
	printIndexInfo(db)
	printTableSizes(db)
	fmt.Println()
	printSeedFlags(db)
}

// ── Row counts ───────────────────────────────────────────────────────────────

func printRowCounts(db *sql.DB) {
	// Discover every table in the current database.
	tableRows, err := db.Query(`
		SELECT TABLE_NAME
		FROM INFORMATION_SCHEMA.TABLES
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_TYPE = 'BASE TABLE'
		ORDER BY TABLE_NAME
	`)
	if err != nil {
		log.Printf("list tables: %v", err)
		return
	}
	defer tableRows.Close()

	var tables []string
	for tableRows.Next() {
		var t string
		if err := tableRows.Scan(&t); err != nil {
			log.Printf("scan table name: %v", err)
			continue
		}
		tables = append(tables, t)
	}

	fmt.Println("=== Row counts ===")
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "Table\tCount")
	fmt.Fprintln(w, strings.Repeat("-", 40)+"\t"+strings.Repeat("-", 12))

	for _, tbl := range tables {
		//nolint:gosec // table name comes from INFORMATION_SCHEMA, not user input
		n, err := queryInt(db, "SELECT COUNT(*) FROM `"+tbl+"`")
		if err != nil {
			fmt.Fprintf(w, "%s\tERROR: %v\n", tbl, err)
			continue
		}
		fmt.Fprintf(w, "%s\t%d\n", tbl, n)
	}
	w.Flush()
	fmt.Println()
}

// ── Index definitions ────────────────────────────────────────────────────────

var trackedTables = []string{
	"dashboard",
	"dashboard_version",
	"dashboard_tag",
	"dashboard_acl",
	"folder",
	"library_element",
	"library_element_connection",
	"annotation",
	"user",
	"org_user",
	"role",
	"permission",
	"builtin_role",
}

func printIndexInfo(db *sql.DB) {
	fmt.Println("=== Index definitions ===")
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "Table\tIndex name\tUnique\tType\tColumns")
	fmt.Fprintln(w, strings.Repeat("-", 28)+"\t"+strings.Repeat("-", 28)+"\t"+strings.Repeat("-", 6)+"\t"+strings.Repeat("-", 6)+"\t"+strings.Repeat("-", 40))

	placeholders := make([]string, len(trackedTables))
	args := make([]any, len(trackedTables))
	for i, t := range trackedTables {
		placeholders[i] = "?"
		args[i] = t
	}

	q := fmt.Sprintf(`
		SELECT
		  TABLE_NAME,
		  INDEX_NAME,
		  IF(NON_UNIQUE=0,'YES','NO') AS is_unique,
		  INDEX_TYPE,
		  GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX SEPARATOR ', ') AS cols
		FROM INFORMATION_SCHEMA.STATISTICS
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME IN (%s)
		GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE, INDEX_TYPE
		ORDER BY TABLE_NAME, INDEX_NAME
	`, strings.Join(placeholders, ","))

	rows, err := db.Query(q, args...)
	if err != nil {
		log.Printf("index query error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var tbl, idx, unique, itype, cols string
		if err := rows.Scan(&tbl, &idx, &unique, &itype, &cols); err != nil {
			log.Printf("scan: %v", err)
			continue
		}
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n", tbl, idx, unique, itype, cols)
	}
	w.Flush()
	fmt.Println()
}

// ── Table sizes ──────────────────────────────────────────────────────────────

func printTableSizes(db *sql.DB) {
	fmt.Println("=== Table sizes (MB) ===")
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "Table\tRows (est)\tData MB\tIndex MB\tTotal MB")
	fmt.Fprintln(w, strings.Repeat("-", 28)+"\t"+strings.Repeat("-", 10)+"\t"+strings.Repeat("-", 8)+"\t"+strings.Repeat("-", 8)+"\t"+strings.Repeat("-", 8))

	placeholders := make([]string, len(trackedTables))
	args := make([]any, len(trackedTables))
	for i, t := range trackedTables {
		placeholders[i] = "?"
		args[i] = t
	}

	q := fmt.Sprintf(`
		SELECT
		  TABLE_NAME,
		  IFNULL(TABLE_ROWS, 0),
		  ROUND(DATA_LENGTH   / 1024 / 1024, 2),
		  ROUND(INDEX_LENGTH  / 1024 / 1024, 2),
		  ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2)
		FROM INFORMATION_SCHEMA.TABLES
		WHERE TABLE_SCHEMA = DATABASE()
		  AND TABLE_NAME IN (%s)
		ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
	`, strings.Join(placeholders, ","))

	rows, err := db.Query(q, args...)
	if err != nil {
		log.Printf("size query error: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var tbl string
		var rowEst int64
		var dataMB, idxMB, totalMB float64
		if err := rows.Scan(&tbl, &rowEst, &dataMB, &idxMB, &totalMB); err != nil {
			log.Printf("scan: %v", err)
			continue
		}
		fmt.Fprintf(w, "%s\t%d\t%.2f\t%.2f\t%.2f\n", tbl, rowEst, dataMB, idxMB, totalMB)
	}
	w.Flush()
}

// ── Suggested seed flags ─────────────────────────────────────────────────────

func printSeedFlags(db *sql.DB) {
	fmt.Println("=== Suggested seed flags ===")

	dashboards, _ := queryInt(db, `SELECT COUNT(*) FROM dashboard WHERE is_folder=0 AND deleted IS NULL`)

	// prefer the new folder table; fall back to dashboard.is_folder
	folders, err := queryInt(db, `SELECT COUNT(*) FROM folder WHERE deleted IS NULL`)
	if err != nil || folders == 0 {
		folders, _ = queryInt(db, `SELECT COUNT(*) FROM dashboard WHERE is_folder=1 AND deleted IS NULL`)
	}

	libElements, _ := queryInt(db, `SELECT COUNT(*) FROM library_element`)

	libConns, _ := queryInt(db, `SELECT COUNT(*) FROM library_element_connection`)
	libConnPerElem := 0
	if libElements > 0 {
		libConnPerElem = int(libConns) / int(libElements)
		if libConnPerElem < 1 {
			libConnPerElem = 1
		}
	}

	editors, _ := queryInt(db, `SELECT COUNT(*) FROM org_user WHERE role='Editor'`)
	viewers, _ := queryInt(db, `SELECT COUNT(*) FROM org_user WHERE role='Viewer'`)
	users := editors + viewers

	// admin-only threshold: folders that have NO explicit non-admin ACL
	// A rough proxy: count folders that only appear in dashboard_acl with role <= Editor
	// Simpler: use half of folders as admin-only (safe default when we can't determine it)
	adminOnly := int64(0)
	adminOnly, _ = queryInt(db, `
		SELECT COUNT(DISTINCT d.id)
		FROM dashboard d
		WHERE d.is_folder = 1
		  AND d.deleted IS NULL
		  AND d.id NOT IN (
		    SELECT dashboard_id FROM dashboard_acl
		    WHERE role IN ('Editor','Viewer') OR team_id > 0
		  )
	`)
	// If adminOnly equals total folders it means all have default ACL — treat 0 as unknown
	if adminOnly == folders {
		adminOnly = 0
	}

	fmt.Printf("\ngo run ./devenv/seed \\\n")
	fmt.Printf("  -url   http://localhost:3000  \\\n")
	fmt.Printf("  -user  admin                  \\\n")
	fmt.Printf("  -pass  admin                  \\\n")
	fmt.Printf("  -folders            %d         \\\n", folders)
	if adminOnly > 0 {
		fmt.Printf("  -admin-only-folders %d         \\\n", adminOnly)
	}
	fmt.Printf("  -dashboards         %d         \\\n", dashboards)
	fmt.Printf("  -library-elements   %d         \\\n", libElements)
	fmt.Printf("  -lib-connections    %d         \\\n", libConnPerElem)
	fmt.Printf("  -users              %d\n", users)

	fmt.Printf("\n# Summary from source DB:\n")
	fmt.Printf("#   dashboards:       %d\n", dashboards)
	fmt.Printf("#   folders:          %d\n", folders)
	fmt.Printf("#   library elements: %d\n", libElements)
	fmt.Printf("#   lib connections:  %d (avg %.1f per element)\n", libConns, safeDiv(libConns, libElements))
	fmt.Printf("#   users (ed+view):  %d  (editors=%d, viewers=%d)\n", users, editors, viewers)
	if adminOnly > 0 {
		fmt.Printf("#   admin-only folders (estimated): %d\n", adminOnly)
	}
}

// ── Helpers ──────────────────────────────────────────────────────────────────

func queryInt(db *sql.DB, q string) (int64, error) {
	var n int64
	if err := db.QueryRow(q).Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}

func safeDiv(a, b int64) float64 {
	if b == 0 {
		return 0
	}
	return float64(a) / float64(b)
}
