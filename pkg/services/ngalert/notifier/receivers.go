package notifier

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"time"

	"github.com/go-openapi/strfmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"golang.org/x/sync/errgroup"
)

const (
	maxTestReceiversWorkers = 10
)

var (
	ErrNoReceivers = errors.New("no receivers")
)

type TestReceiversResult struct {
	Alert     types.Alert
	Receivers []TestReceiverResult
	NotifedAt time.Time
}

type TestReceiverResult struct {
	Name    string
	Configs []TestReceiverConfigResult
}

type TestReceiverConfigResult struct {
	Name   string
	UID    string
	Status string
	Error  error
}

type InvalidReceiverError struct {
	Receiver *apimodels.PostableGrafanaReceiver
	Err      error
}

func (e InvalidReceiverError) Error() string {
	return fmt.Sprintf("the receiver is invalid: %s", e.Err)
}

type ReceiverTimeoutError struct {
	Receiver *apimodels.PostableGrafanaReceiver
	Err      error
}

func (e ReceiverTimeoutError) Error() string {
	return fmt.Sprintf("the receiver timed out: %s", e.Err)
}

func (am *Alertmanager) TestReceivers(ctx context.Context, c apimodels.TestReceiversConfigBodyParams) (*TestReceiversResult, error) {
	// now represents the start time of the test
	now := time.Now()
	testAlert := newTestAlert(c, now, now)

	// we must set a group key that is unique per test as some receivers use this key to deduplicate alerts
	ctx = notify.WithGroupKey(ctx, testAlert.Labels.String()+now.String())

	tmpl, err := am.getTemplate()
	if err != nil {
		return nil, fmt.Errorf("failed to get template: %w", err)
	}

	// job contains all metadata required to test a receiver
	type job struct {
		Config       *apimodels.PostableGrafanaReceiver
		ReceiverName string
		Notifier     notify.Notifier
	}

	// result contains the receiver that was tested and an error that is non-nil if the test failed
	type result struct {
		Config       *apimodels.PostableGrafanaReceiver
		ReceiverName string
		Error        error
	}

	newTestReceiversResult := func(alert types.Alert, results []result, notifiedAt time.Time) *TestReceiversResult {
		m := make(map[string]TestReceiverResult)
		for _, receiver := range c.Receivers {
			// set up the result for this receiver
			m[receiver.Name] = TestReceiverResult{
				Name: receiver.Name,
				// A Grafana receiver can have multiple nested receivers
				Configs: make([]TestReceiverConfigResult, 0, len(receiver.GrafanaManagedReceivers)),
			}
		}
		for _, next := range results {
			tmp := m[next.ReceiverName]
			status := "ok"
			if next.Error != nil {
				status = "failed"
			}
			tmp.Configs = append(tmp.Configs, TestReceiverConfigResult{
				Name:   next.Config.Name,
				UID:    next.Config.UID,
				Status: status,
				Error:  processNotifierError(next.Config, next.Error),
			})
			m[next.ReceiverName] = tmp
		}
		v := new(TestReceiversResult)
		v.Alert = alert
		v.Receivers = make([]TestReceiverResult, 0, len(c.Receivers))
		v.NotifedAt = notifiedAt
		for _, next := range m {
			v.Receivers = append(v.Receivers, next)
		}

		// Make sure the return order is deterministic.
		sort.Slice(v.Receivers, func(i, j int) bool {
			return v.Receivers[i].Name < v.Receivers[j].Name
		})

		return v
	}

	// invalid keeps track of all invalid receiver configurations
	invalid := make([]result, 0, len(c.Receivers))
	// jobs keeps track of all receivers that need to be sent test notifications
	jobs := make([]job, 0, len(c.Receivers))

	for _, receiver := range c.Receivers {
		for _, next := range receiver.GrafanaManagedReceivers {
			n, err := am.buildReceiverIntegration(next, tmpl)
			if err != nil {
				invalid = append(invalid, result{
					Config:       next,
					ReceiverName: next.Name,
					Error:        err,
				})
			} else {
				jobs = append(jobs, job{
					Config:       next,
					ReceiverName: receiver.Name,
					Notifier:     n,
				})
			}
		}
	}

	if len(invalid)+len(jobs) == 0 {
		return nil, ErrNoReceivers
	}

	if len(jobs) == 0 {
		return newTestReceiversResult(testAlert, invalid, now), nil
	}

	numWorkers := maxTestReceiversWorkers
	if numWorkers > len(jobs) {
		numWorkers = len(jobs)
	}

	resultCh := make(chan result, len(jobs))
	workCh := make(chan job, len(jobs))
	for _, job := range jobs {
		workCh <- job
	}
	close(workCh)

	g, ctx := errgroup.WithContext(ctx)
	for i := 0; i < numWorkers; i++ {
		g.Go(func() error {
			for next := range workCh {
				v := result{
					Config:       next.Config,
					ReceiverName: next.ReceiverName,
				}
				if _, err := next.Notifier.Notify(ctx, &testAlert); err != nil {
					v.Error = err
				}
				resultCh <- v
			}
			return nil
		})
	}
	g.Wait() // nolint
	close(resultCh)

	results := make([]result, 0, len(jobs))
	for next := range resultCh {
		results = append(results, next)
	}

	return newTestReceiversResult(testAlert, append(invalid, results...), now), nil
}

func (am *Alertmanager) GetReceivers(ctx context.Context) []apimodels.Receiver {
	am.reloadConfigMtx.RLock()
	defer am.reloadConfigMtx.RUnlock()

	apiReceivers := make([]apimodels.Receiver, 0, len(am.receivers))
	for _, rcv := range am.receivers {
		// Build integrations slice for each receiver.
		var integrations []*models.Integration
		for _, integration := range rcv.Integrations() {
			name := integration.Name()
			sendResolved := integration.SendResolved()
			ts, d, err := integration.GetReport()
			integrations = append(integrations, &apimodels.Integration{
				Name:                      &name,
				SendResolved:              &sendResolved,
				LastNotifyAttempt:         strfmt.DateTime(ts),
				LastNotifyAttemptDuration: d.String(),
				LastNotifyAttemptError: func() string {
					if err != nil {
						return err.Error()
					}
					return ""
				}(),
			})
		}

		active := rcv.Active()
		name := rcv.Name()
		apiReceivers = append(apiReceivers, apimodels.Receiver{
			Active:       &active,
			Integrations: integrations,
			Name:         &name,
		})
	}

	return apiReceivers
}

func newTestAlert(c apimodels.TestReceiversConfigBodyParams, startsAt, updatedAt time.Time) types.Alert {
	var (
		defaultAnnotations = model.LabelSet{
			"summary":          "Notification test",
			"__value_string__": "[ metric='foo' labels={instance=bar} value=10 ]",
		}
		defaultLabels = model.LabelSet{
			"alertname": "TestAlert",
			"instance":  "Grafana",
		}
	)

	alert := types.Alert{
		Alert: model.Alert{
			Labels:      defaultLabels,
			Annotations: defaultAnnotations,
			StartsAt:    startsAt,
		},
		UpdatedAt: updatedAt,
	}

	if c.Alert != nil {
		if c.Alert.Annotations != nil {
			for k, v := range c.Alert.Annotations {
				alert.Annotations[k] = v
			}
		}
		if c.Alert.Labels != nil {
			for k, v := range c.Alert.Labels {
				alert.Labels[k] = v
			}
		}
	}

	return alert
}

func processNotifierError(config *apimodels.PostableGrafanaReceiver, err error) error {
	if err == nil {
		return nil
	}

	var urlError *url.Error
	if errors.As(err, &urlError) {
		if urlError.Timeout() {
			return ReceiverTimeoutError{
				Receiver: config,
				Err:      err,
			}
		}
	}

	if errors.Is(err, context.DeadlineExceeded) {
		return ReceiverTimeoutError{
			Receiver: config,
			Err:      err,
		}
	}

	return err
}
