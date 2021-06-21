package channels

import (
	"context"
	"io/ioutil"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func TestDefaultTemplateString(t *testing.T) {
	alerts := []*types.Alert{
		{ // Firing with dashboard and panel ID.
			Alert: model.Alert{
				Labels: model.LabelSet{"alertname": "alert1", "lbl1": "val1"},
				Annotations: model.LabelSet{
					"ann1": "annv1", "__dashboardUid__": "dbuid123", "__panelId__": "puid123",
				},
				StartsAt:     time.Now(),
				EndsAt:       time.Now().Add(1 * time.Hour),
				GeneratorURL: "http://localhost/alert1",
			},
		}, { // Firing without dashboard and panel ID.
			Alert: model.Alert{
				Labels:       model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
				Annotations:  model.LabelSet{"ann1": "annv2"},
				StartsAt:     time.Now(),
				EndsAt:       time.Now().Add(2 * time.Hour),
				GeneratorURL: "http://localhost/alert2",
			},
		}, { // Resolved with dashboard and panel ID.
			Alert: model.Alert{
				Labels: model.LabelSet{"alertname": "alert1", "lbl1": "val3"},
				Annotations: model.LabelSet{
					"ann1": "annv3", "__dashboardUid__": "dbuid456", "__panelId__": "puid456",
				},
				StartsAt:     time.Now().Add(-1 * time.Hour),
				EndsAt:       time.Now().Add(-30 * time.Minute),
				GeneratorURL: "http://localhost/alert3",
			},
		}, { // Resolved without dashboard and panel ID.
			Alert: model.Alert{
				Labels:       model.LabelSet{"alertname": "alert1", "lbl1": "val4"},
				Annotations:  model.LabelSet{"ann1": "annv4"},
				StartsAt:     time.Now().Add(-2 * time.Hour),
				EndsAt:       time.Now().Add(-3 * time.Hour),
				GeneratorURL: "http://localhost/alert4",
			},
		},
	}

	f, err := ioutil.TempFile("/tmp", "template")
	require.NoError(t, err)

	t.Cleanup(func() {
		require.NoError(t, os.RemoveAll(f.Name()))
	})

	_, err = f.WriteString(DefaultTemplateString)
	require.NoError(t, err)

	tmpl, err := template.FromGlobs(f.Name())
	require.NoError(t, err)

	externalURL, err := url.Parse("http://localhost/grafana")
	require.NoError(t, err)
	tmpl.ExternalURL = externalURL

	var tmplErr error
	l := log.New("default-template-test")
	expand, _ := TmplText(context.Background(), tmpl, alerts, l, &tmplErr)

	cases := []struct {
		templateString string
		expected       string
	}{
		{
			templateString: `{{ template "default.title" .}}`,
			expected:       `[FIRING:2]  (alert1)`,
		},
		{
			templateString: `{{ template "default.message" .}}`,
			expected: `**Firing**

Labels:
 - alertname = alert1
 - lbl1 = val1
Annotations:
 - ann1 = annv1
Source: http://localhost/alert1
Silence: http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval1
Dashboard: http://localhost/grafana/d/dbuid123
Panel: http://localhost/grafana/d/dbuid123?viewPanel=puid123

Labels:
 - alertname = alert1
 - lbl1 = val2
Annotations:
 - ann1 = annv2
Source: http://localhost/alert2
Silence: http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval2


**Resolved**

Labels:
 - alertname = alert1
 - lbl1 = val3
Annotations:
 - ann1 = annv3
Source: http://localhost/alert3
Silence: http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval3
Dashboard: http://localhost/grafana/d/dbuid456
Panel: http://localhost/grafana/d/dbuid456?viewPanel=puid456

Labels:
 - alertname = alert1
 - lbl1 = val4
Annotations:
 - ann1 = annv4
Source: http://localhost/alert4
Silence: http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matchers=alertname%3Dalert1%2Clbl1%3Dval4
`,
		},
	}

	for _, c := range cases {
		t.Run(c.templateString, func(t *testing.T) {
			act := expand(c.templateString)
			require.NoError(t, tmplErr)
			require.Equal(t, c.expected, act)
		})
	}
	require.NoError(t, tmplErr)
}
