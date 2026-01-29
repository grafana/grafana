package resource

//go:generate sh -c "cd ../../../.. && bash pkg/storage/unified/resource/generate_manifests.sh"

import (
	"github.com/grafana/grafana-app-sdk/app"

	advisor "github.com/grafana/grafana/apps/advisor/pkg/apis"
	alerting_historian "github.com/grafana/grafana/apps/alerting/historian/pkg/apis"
	alerting_notifications "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis"
	alerting_rules "github.com/grafana/grafana/apps/alerting/rules/pkg/apis"
	annotation "github.com/grafana/grafana/apps/annotation/pkg/apis"
	collections "github.com/grafana/grafana/apps/collections/pkg/apis/manifestdata"
	correlations "github.com/grafana/grafana/apps/correlations/pkg/apis"
	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis"
	dashvalidator "github.com/grafana/grafana/apps/dashvalidator/pkg/apis/manifestdata"
	dashvalidator1 "github.com/grafana/grafana/apps/dashvalidator/pkg/generated/manifestdata"
	example "github.com/grafana/grafana/apps/example/pkg/apis/manifestdata"
	folder "github.com/grafana/grafana/apps/folder/pkg/apis/manifestdata"
	iam "github.com/grafana/grafana/apps/iam/pkg/apis"
	live "github.com/grafana/grafana/apps/live/pkg/apis/manifestdata"
	logsdrilldown "github.com/grafana/grafana/apps/logsdrilldown/pkg/apis"
	playlist "github.com/grafana/grafana/apps/playlist/pkg/apis/manifestdata"
	plugins "github.com/grafana/grafana/apps/plugins/pkg/apis"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/manifestdata"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/manifestdata"
	quotas "github.com/grafana/grafana/apps/quotas/pkg/apis"
	secret "github.com/grafana/grafana/apps/secret/pkg/apis"
	shorturl "github.com/grafana/grafana/apps/shorturl/pkg/apis"
)

func AppManifests() []app.Manifest {
	// TODO: don't use hardcoded list of manifests when possible.
	return []app.Manifest{
		advisor.LocalManifest(),
		alerting_historian.LocalManifest(),
		alerting_notifications.LocalManifest(),
		alerting_rules.LocalManifest(),
		annotation.LocalManifest(),
		collections.LocalManifest(),
		correlations.LocalManifest(),
		dashboard.LocalManifest(),
		dashvalidator.LocalManifest(),
		dashvalidator1.LocalManifest(),
		example.LocalManifest(),
		folder.LocalManifest(),
		iam.LocalManifest(),
		live.LocalManifest(),
		logsdrilldown.LocalManifest(),
		playlist.LocalManifest(),
		plugins.LocalManifest(),
		preferences.LocalManifest(),
		provisioning.LocalManifest(),
		quotas.LocalManifest(),
		secret.LocalManifest(),
		shorturl.LocalManifest(),
	}
}
