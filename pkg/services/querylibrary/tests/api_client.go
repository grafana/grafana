package querylibrary_tests

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/querylibrary"
	"github.com/grafana/grafana/pkg/services/user"
)

type queryLibraryAPIClient struct {
	token    string
	url      string
	user     *user.SignedInUser
	sqlStore db.DB
}

func newQueryLibraryAPIClient(token string, baseUrl string, user *user.SignedInUser, sqlStore db.DB) *queryLibraryAPIClient {
	return &queryLibraryAPIClient{
		token:    token,
		url:      baseUrl,
		user:     user,
		sqlStore: sqlStore,
	}
}

func (q *queryLibraryAPIClient) update(ctx context.Context, query *querylibrary.Query) error {
	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	err := enc.Encode(query)
	if err != nil {
		return err
	}

	url := fmt.Sprintf("%s/query-library", q.url)

	req, err := http.NewRequestWithContext(ctx, "POST", url, &buf)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", q.token))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}

	_ = resp.Body.Close()
	return nil
}

func (q *queryLibraryAPIClient) delete(ctx context.Context, uid string) error {
	url := fmt.Sprintf("%s/query-library?uid=%s", q.url, uid)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, bytes.NewBuffer([]byte("")))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", q.token))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	defer func() {
		_ = resp.Body.Close()
	}()

	return err
}

func (q *queryLibraryAPIClient) get(ctx context.Context, uid string) (*querylibrary.Query, error) {
	url := fmt.Sprintf("%s/query-library?uid=%s", q.url, uid)

	req, err := http.NewRequestWithContext(ctx, "GET", url, bytes.NewBuffer([]byte("")))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", q.token))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	query := make([]*querylibrary.Query, 0)
	err = json.Unmarshal(b, &query)
	if len(query) > 0 {
		return query[0], err
	}

	return nil, err
}

type querySearchInfo struct {
	kind     string
	uid      string
	name     string
	dsUIDs   []string
	location string
}

func (q *queryLibraryAPIClient) search(ctx context.Context, options querylibrary.QuerySearchOptions) ([]*querySearchInfo, error) {
	return q.searchRetry(ctx, options, 1)
}

func (q *queryLibraryAPIClient) searchRetry(ctx context.Context, options querylibrary.QuerySearchOptions, attempt int) ([]*querySearchInfo, error) {
	if attempt >= 3 {
		return nil, errors.New("max attempts")
	}

	url := fmt.Sprintf("%s/search-v2", q.url)

	text := "*"
	if options.Query != "" {
		text = options.Query
	}

	searchReq := map[string]interface{}{
		"query": text,
		"sort":  "name_sort",
		"kind":  []string{"query"},
		"limit": 50,
	}

	searchReqJson, err := simplejson.NewFromAny(searchReq).MarshalJSON()
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(searchReqJson))

	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", q.token))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	r := &backend.DataResponse{}
	err = json.Unmarshal(b, r)

	if len(r.Frames) != 1 {
		return nil, fmt.Errorf("expected a single frame, received %s", string(b))
	}

	frame := r.Frames[0]
	if frame.Name == "Loading" {
		time.Sleep(100 * time.Millisecond)
		return q.searchRetry(ctx, options, attempt+1)
	}

	res := make([]*querySearchInfo, 0)

	frameLen, _ := frame.RowLen()
	for i := 0; i < frameLen; i++ {
		fKind, _ := frame.FieldByName("kind")
		fUid, _ := frame.FieldByName("uid")
		fName, _ := frame.FieldByName("name")
		dsUID, _ := frame.FieldByName("ds_uid")
		fLocation, _ := frame.FieldByName("location")

		rawValue, ok := dsUID.At(i).(json.RawMessage)
		if !ok || rawValue == nil {
			return nil, errors.New("invalid ds_uid field")
		}

		jsonValue, err := rawValue.MarshalJSON()
		if err != nil {
			return nil, err
		}

		var uids []string
		err = json.Unmarshal(jsonValue, &uids)
		if err != nil {
			return nil, err
		}

		res = append(res, &querySearchInfo{
			kind:     fKind.At(i).(string),
			uid:      fUid.At(i).(string),
			name:     fName.At(i).(string),
			dsUIDs:   uids,
			location: fLocation.At(i).(string),
		})
	}
	return res, err
}

func (q *queryLibraryAPIClient) getDashboard(ctx context.Context, uid string) (*dtos.DashboardFullWithMeta, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", fmt.Sprintf("%s/dashboards/uid/%s", q.url, uid), bytes.NewBuffer([]byte("")))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", q.token))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	res := &dtos.DashboardFullWithMeta{}
	err = json.Unmarshal(b, res)
	if err != nil {
		return nil, err
	}

	return res, nil
}

func (q *queryLibraryAPIClient) createDashboard(ctx context.Context, dash *simplejson.Json) (string, error) {
	buf := bytes.Buffer{}
	enc := json.NewEncoder(&buf)
	dashMap, err := dash.Map()
	if err != nil {
		return "", err
	}
	err = enc.Encode(dashMap)
	if err != nil {
		return "", err
	}

	url := fmt.Sprintf("%s/dashboards/db", q.url)

	req, err := http.NewRequestWithContext(ctx, "POST", url, &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", q.token))
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{}
	resp, err := client.Do(req)
	defer func() {
		_ = resp.Body.Close()
	}()
	if err != nil {
		return "", err
	}

	jsonResp, err := simplejson.NewFromReader(resp.Body)
	if err != nil {
		return "", err
	}

	return jsonResp.Get("uid").MustString(), nil
}
