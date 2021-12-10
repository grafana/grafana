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
	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/smithy/build/go/grafana"
	"github.com/grafana/grafana/smithy/build/go/grafana/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type httpClient struct {
	http.Client

	t    *testing.T
	addr string
}

func (c *httpClient) Do(req *http.Request) (*http.Response, error) {
	c.t.Helper()
	u, err := url.Parse(fmt.Sprintf("http://%s%s", c.addr, req.URL.Path))
	require.NoError(c.t, err)
	req.URL = u
	c.t.Logf("Performing request, URL: %q, method: %s", req.URL, req.Method)
	return c.Client.Do(req)
}

func TestGetAlert(t *testing.T) {
	grafDir, cfgPath := testinfra.CreateGrafDir(t)
	addr, sqlStore := testinfra.StartGrafana(t, grafDir, cfgPath)
	t.Logf("Server running at %s", addr)

	ctx := context.Background()
	client := grafana.New(grafana.Options{
		HTTPClient: &httpClient{
			t:    t,
			addr: addr,
		},
		/*
			APIOptions: []func(*middleware.Stack) error{
				func(stack *middleware.Stack) error {
					if err := stack.Build.Add(&buildRequest{
						addr: addr,
						op:   getAlertOp,
					}, middleware.After); err != nil {
						return err
					}
					return stack.Deserialize.Add(&deserializeResponse{
						t:  t,
						op: getAlertOp,
					}, middleware.After)
				},
			},
		*/
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
		out, err := client.GetAlert(ctx, &grafana.GetAlertInput{
			Id: &alertID,
		})
		require.NoError(t, err)

		panelID := strconv.FormatInt(alert.PanelId, 10)
		state := string(alert.State)
		created := alert.Created.Truncate(time.Second)
		updated := alert.Updated.Truncate(time.Second)
		exp := grafana.GetAlertOutput{
			Id:          &alertID,
			Version:     alert.Version,
			OrgId:       alert.OrgId,
			DashboardId: alert.DashboardId,
			PanelId:     &panelID,
			Name:        &alert.Name,
			Message:     &alert.Message,
			State:       &state,
			Created:     &created,
			Updated:     &updated,
		}
		diff := cmp.Diff(exp, *out, cmpopts.IgnoreUnexported(middleware.Metadata{}))
		assert.Empty(t, diff)
	})
}

func TestPauseAlert(t *testing.T) {
	grafDir, cfgPath := testinfra.CreateGrafDir(t)
	addr, sqlStore := testinfra.StartGrafana(t, grafDir, cfgPath)
	t.Logf("Server running at %s", addr)

	ctx := context.Background()

	client := grafana.New(grafana.Options{
		HTTPClient: &httpClient{
			t: t,
		},
		APIOptions: []func(*middleware.Stack) error{
			func(stack *middleware.Stack) error {
				if err := stack.Build.Add(&buildRequest{
					addr: addr,
					op:   pauseAlertOp,
				}, middleware.After); err != nil {
					return err
				}
				return stack.Deserialize.Add(&deserializeResponse{
					t:  t,
					op: pauseAlertOp,
				}, middleware.After)
			},
		},
	})

	t.Run("Without permission", func(t *testing.T) {
		t.Run("Non-existent alert", func(t *testing.T) {
			alertID := "1234"
			_, err := client.PauseAlert(ctx, &grafana.PauseAlertInput{
				Id:     &alertID,
				Paused: true,
			})
			require.EqualError(t, err,
				"operation error grafana#Grafana: PauseAlert, HTTP request failed with status code 403: Permission denied")
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
			_, err := client.PauseAlert(ctx, &grafana.PauseAlertInput{
				Id:     &alertID,
				Paused: true,
			})
			require.EqualError(t, err,
				"operation error grafana#Grafana: PauseAlert, HTTP request failed with status code 403: Permission denied")
		})
	})
}

func TestListAlerts(t *testing.T) {
	grafDir, cfgPath := testinfra.CreateGrafDir(t)
	addr, _ := testinfra.StartGrafana(t, grafDir, cfgPath)
	t.Logf("Server running at %s", addr)

	ctx := context.Background()
	client := grafana.New(grafana.Options{
		HTTPClient: &httpClient{
			t: t,
		},
		APIOptions: []func(*middleware.Stack) error{
			func(stack *middleware.Stack) error {
				if err := stack.Build.Add(&buildRequest{
					addr: addr,
					op:   listAlertsOp,
				}, middleware.After); err != nil {
					return err
				}
				return stack.Deserialize.Add(&deserializeResponse{
					t:  t,
					op: listAlertsOp,
				}, middleware.After)
			},
		},
	})

	t.Run("No alerts", func(t *testing.T) {
		out, err := client.ListAlerts(ctx, &grafana.ListAlertsInput{})
		require.NoError(t, err)

		exp := grafana.ListAlertsOutput{
			Items: []types.AlertSummary{},
		}
		diff := cmp.Diff(exp, *out, cmpopts.IgnoreUnexported(middleware.Metadata{}))
		assert.Empty(t, diff)
	})
}

type apiOp int

const (
	getAlertOp apiOp = iota
	pauseAlertOp
	listAlertsOp
)

type buildRequest struct {
	addr string
	op   apiOp
}

func (br *buildRequest) ID() string {
	return "BuildRequest"
}

func (br *buildRequest) HandleBuild(ctx context.Context, in middleware.BuildInput,
	next middleware.BuildHandler) (middleware.BuildOutput, middleware.Metadata, error) {
	req := in.Request.(*smithyhttp.Request)
	var path string
	method := "GET"
	switch br.op {
	case getAlertOp:
		path = "/alerts/1"
	case pauseAlertOp:
		path = "/alerts/1/pause"
		method = "POST"
	case listAlertsOp:
		path = "/alerts"
	default:
		panic(fmt.Sprintf("Unrecognized op %d", br.op))
	}
	var err error
	req.URL, err = url.Parse(fmt.Sprintf("http://%s/api%s", br.addr, path))
	if err != nil {
		return middleware.BuildOutput{}, middleware.Metadata{}, err
	}
	req.Method = method
	return next.HandleBuild(ctx, in)
}

type deserializeResponse struct {
	t  *testing.T
	op apiOp
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

	switch dr.op {
	case getAlertOp:
		var alert grafana.GetAlertOutput
		if err := json.Unmarshal(body, &alert); err != nil {
			return out, metadata, err
		}
		out.Result = &alert
	case listAlertsOp:
		var alerts grafana.ListAlertsOutput
		if err := json.Unmarshal(body, &alerts); err != nil {
			return out, metadata, err
		}
		out.Result = &alerts
	default:
		panic(fmt.Sprintf("unrecognized op %d", dr.op))
	}

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
