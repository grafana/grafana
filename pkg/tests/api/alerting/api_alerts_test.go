package alerting

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"testing"
	"time"

	"github.com/aws/smithy-go/middleware"
	smithyhttp "github.com/aws/smithy-go/transport/http"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/smithy/build/go/grafana"
	"github.com/stretchr/testify/require"
)

type httpClient struct {
	http.Client

	t *testing.T
}

func (c *httpClient) Do(req *http.Request) (*http.Response, error) {
	c.t.Logf("Performing request: %q", req.URL)
	return c.Client.Do(req)
}

func TestGetAlert(t *testing.T) {
	grafDir, cfgPath := testinfra.CreateGrafDir(t)
	sqlStore := setUpDatabase(t, grafDir)
	addr := testinfra.StartGrafana(t, grafDir, cfgPath, sqlStore)
	t.Logf("Server running at %s", addr)

	ctx := context.Background()
	// The Go Smithy plugin seems unfinished - might want to have APIOptions to modify the stack in order to just hack
	// the implementation, so it:
	//   * Picks the right endpoint based on the opID
	//   * Serializes the body correctly
	//   * Deserializes the response correctly
	client := grafana.New(grafana.Options{
		HTTPClient: &httpClient{
			t: t,
		},
		APIOptions: []func(*middleware.Stack) error{
			func(stack *middleware.Stack) error {
				if err := stack.Build.Add(&buildRequest{
					addr: addr,
				}, middleware.After); err != nil {
					return err
				}
				return stack.Deserialize.Add(&deserializeResponse{t: t}, middleware.After)
			},
		},
	})

	t.Run("Non-existent alert", func(t *testing.T) {
		alertID := "1234"
		_, err := client.GetAlert(ctx, &grafana.GetAlertInput{
			Id: &alertID,
		})
		require.EqualError(t, err,
			"operation error grafana#Grafana: GetAlert, HTTP request failed with status code 404: Alert not found")
	})

	t.Run("Existing alert", func(t *testing.T) {
		now := time.Now().UTC()
		alert := models.Alert{
			Updated:      now,
			Created:      now,
			State:        models.AlertStateUnknown,
			NewStateDate: now,
			// Create with the same org ID as we'll be querying with
			OrgId: 2,
		}
		sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
			_, err := sess.Insert(&alert)
			return err
		})
		alertID := strconv.FormatInt(alert.Id, 10)
		_, err := client.GetAlert(ctx, &grafana.GetAlertInput{
			Id: &alertID,
		})
		require.NoError(t, err)
	})
}

type buildRequest struct {
	addr string
}

func (br *buildRequest) ID() string {
	return "BuildRequest"
}

func (br *buildRequest) HandleBuild(ctx context.Context, in middleware.BuildInput,
	next middleware.BuildHandler) (middleware.BuildOutput, middleware.Metadata, error) {
	req := in.Request.(*smithyhttp.Request)
	var err error
	req.URL, err = url.Parse(fmt.Sprintf("http://%s/api/alerts/1", br.addr))
	if err != nil {
		return middleware.BuildOutput{}, middleware.Metadata{}, err
	}
	return next.HandleBuild(ctx, in)
}

type deserializeResponse struct {
	t *testing.T
}

func (dr *deserializeResponse) ID() string {
	return "DeserializeResponse"
}

type errorResponse struct {
	Message string `json:"message"`
}

func (dr *deserializeResponse) HandleDeserialize(ctx context.Context, in middleware.DeserializeInput,
	next middleware.DeserializeHandler) (middleware.DeserializeOutput, middleware.Metadata, error) {
	out, metadata, err := next.HandleDeserialize(ctx, in)
	if err != nil {
		return out, metadata, err
	}

	resp := out.RawResponse.(*smithyhttp.Response).Response
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return out, metadata, err
	}
	if resp.StatusCode/100 != 2 {
		msg := string(body)
		var errResp errorResponse
		if err := json.Unmarshal(body, &errResp); err == nil {
			msg = errResp.Message
		}
		return out, metadata, fmt.Errorf("HTTP request failed with status code %d: %s", resp.StatusCode, msg)
	}

	dr.t.Logf("Deserializing %s", string(body))

	out.RawResponse = body
	var alert grafana.GetAlertOutput
	if err := json.Unmarshal(body, &alert); err != nil {
		return out, metadata, err
	}
	out.Result = &alert

	return out, metadata, nil
}

func setUpDatabase(t *testing.T, grafDir string) *sqlstore.SQLStore {
	t.Helper()

	sqlStore := testinfra.SetUpDatabase(t, grafDir)

	// Make sure changes are synced with other goroutines
	err := sqlStore.Sync()
	require.NoError(t, err)

	return sqlStore
}
