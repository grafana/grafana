package channels

import (
	"context"
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
					"ann1": "annv1", "__orgId__": "1", "__dashboardUid__": "dbuid123", "__panelId__": "puid123", "__values__": "{\"A\": 1234}", "__value_string__": "1234",
				},
				StartsAt:     time.Now(),
				EndsAt:       time.Now().Add(1 * time.Hour),
				GeneratorURL: "http://localhost/alert1?orgId=1",
			},
		}, { // Firing without dashboard and panel ID.
			Alert: model.Alert{
				Labels:       model.LabelSet{"alertname": "alert1", "lbl1": "val2"},
				Annotations:  model.LabelSet{"ann1": "annv2", "__values__": "{\"A\": 1234}", "__value_string__": "1234"},
				StartsAt:     time.Now(),
				EndsAt:       time.Now().Add(2 * time.Hour),
				GeneratorURL: "http://localhost/alert2",
			},
		}, { // Resolved with dashboard and panel ID.
			Alert: model.Alert{
				Labels: model.LabelSet{"alertname": "alert1", "lbl1": "val3"},
				Annotations: model.LabelSet{
					"ann1": "annv3", "__orgId__": "1", "__dashboardUid__": "dbuid456", "__panelId__": "puid456", "__values__": "{\"A\": 1234}", "__value_string__": "1234",
				},
				StartsAt:     time.Now().Add(-1 * time.Hour),
				EndsAt:       time.Now().Add(-30 * time.Minute),
				GeneratorURL: "http://localhost/alert3",
			},
		}, { // Resolved without dashboard and panel ID.
			Alert: model.Alert{
				Labels:       model.LabelSet{"alertname": "alert1", "lbl1": "val4"},
				Annotations:  model.LabelSet{"ann1": "annv4", "__values__": "{\"A\": 1234}", "__value_string__": "1234"},
				StartsAt:     time.Now().Add(-2 * time.Hour),
				EndsAt:       time.Now().Add(-3 * time.Hour),
				GeneratorURL: "http://localhost/alert4",
			},
		},
	}

	f, err := os.CreateTemp("/tmp", "template")
	require.NoError(t, err)
	defer func(f *os.File) {
		_ = f.Close()
	}(f)

	t.Cleanup(func() {
		require.NoError(t, os.RemoveAll(f.Name()))
	})

	_, err = f.WriteString(DefaultTemplateString)
	require.NoError(t, err)

	tmpl, err := template.FromGlobs([]string{f.Name()})
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
			templateString: DefaultMessageTitleEmbed,
			expected:       `[FIRING:2, RESOLVED:2]  (alert1)`,
		},
		{
			templateString: DefaultMessageEmbed,
			expected: `**Firing**

Value: A=1234
Labels:
 - alertname = alert1
 - lbl1 = val1
Annotations:
 - ann1 = annv1
Source: http://localhost/alert1?orgId=1
Silence: http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1
Dashboard: http://localhost/grafana/d/dbuid123?orgId=1
Panel: http://localhost/grafana/d/dbuid123?orgId=1&viewPanel=puid123

Value: A=1234
Labels:
 - alertname = alert1
 - lbl1 = val2
Annotations:
 - ann1 = annv2
Source: http://localhost/alert2
Silence: http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2


**Resolved**

Value: A=1234
Labels:
 - alertname = alert1
 - lbl1 = val3
Annotations:
 - ann1 = annv3
Source: http://localhost/alert3?orgId=1
Silence: http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval3
Dashboard: http://localhost/grafana/d/dbuid456?orgId=1
Panel: http://localhost/grafana/d/dbuid456?orgId=1&viewPanel=puid456

Value: A=1234
Labels:
 - alertname = alert1
 - lbl1 = val4
Annotations:
 - ann1 = annv4
Source: http://localhost/alert4
Silence: http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval4
`,
		},
		{
			templateString: `{{ template "teams.default.message" .}}`,
			expected: `**Firing**

Value: A=1234
Labels:
 - alertname = alert1
 - lbl1 = val1

Annotations:
 - ann1 = annv1

Source: [http://localhost/alert1?orgId=1](http://localhost/alert1?orgId=1)

Silence: [http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1](http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval1)

Dashboard: [http://localhost/grafana/d/dbuid123?orgId=1](http://localhost/grafana/d/dbuid123?orgId=1)

Panel: [http://localhost/grafana/d/dbuid123?orgId=1&viewPanel=puid123](http://localhost/grafana/d/dbuid123?orgId=1&viewPanel=puid123)



Value: A=1234
Labels:
 - alertname = alert1
 - lbl1 = val2

Annotations:
 - ann1 = annv2

Source: [http://localhost/alert2](http://localhost/alert2)

Silence: [http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2](http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval2)




**Resolved**

Value: A=1234
Labels:
 - alertname = alert1
 - lbl1 = val3

Annotations:
 - ann1 = annv3

Source: [http://localhost/alert3?orgId=1](http://localhost/alert3?orgId=1)

Silence: [http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval3](http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval3)

Dashboard: [http://localhost/grafana/d/dbuid456?orgId=1](http://localhost/grafana/d/dbuid456?orgId=1)

Panel: [http://localhost/grafana/d/dbuid456?orgId=1&viewPanel=puid456](http://localhost/grafana/d/dbuid456?orgId=1&viewPanel=puid456)



Value: A=1234
Labels:
 - alertname = alert1
 - lbl1 = val4

Annotations:
 - ann1 = annv4

Source: [http://localhost/alert4](http://localhost/alert4)

Silence: [http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval4](http://localhost/grafana/alerting/silence/new?alertmanager=grafana&matcher=alertname%3Dalert1&matcher=lbl1%3Dval4)


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
