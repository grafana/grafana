package msi

import (
	"fmt"

	"dagger.io/dagger"
	"github.com/grafana/grafana/pkg/build/daggerbuild/containers"
)

func Build(d *dagger.Client, builder *dagger.Container, targz *dagger.File, version string, enterprise bool) (*dagger.File, error) {
	wxsFiles, err := WXSFiles(version, enterprise)
	if err != nil {
		return nil, fmt.Errorf("error generating wxs files: %w", err)
	}

	f := containers.ExtractedArchive(d, targz)
	builder = builder.WithDirectory("/src/grafana", f, dagger.ContainerWithDirectoryOpts{
		// Hack from grafana/build-pipeline: Remove files with names too long...
		Exclude: []string{
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/app_insights/app_insights_querystring_builder.test.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/app_insights/app_insights_querystring_builder.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_log_analytics/azure_log_analytics_datasource.test.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_log_analytics/azure_log_analytics_datasource.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_datasource.test.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_datasource.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/app_insights/app_insights_datasource.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/app_insights/app_insights_datasource.test.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/insights_analytics/insights_analytics_datasource.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_filter_builder.test.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_filter_builder.ts",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/components/AnalyticsConfig.test.tsx",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/components/AzureCredentialsForm.test.tsx",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/components/InsightsConfig.test.tsx",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/components/__snapshots__/AnalyticsConfig.test.tsx.snap",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/components/__snapshots__/AzureCredentialsForm.test.tsx.snap",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/components/__snapshots__/InsightsConfig.test.tsx.snap",
			"public/app/plugins/datasource/grafana-azure-monitor-datasource/components/__snapshots__/ConfigEditor.test.tsx.snap",
			"storybook",
		},
	}).WithWorkdir("/src")

	for _, v := range wxsFiles {
		builder = builder.WithNewFile(v.Name, v.Contents)
	}

	// 1. `heat`: create 'grafana.wxs'
	// 2. 'candle': Compile .wxs files into .wixobj
	// 3. `light`: assembles the MSI
	builder = builder.
		WithExec([]string{"/bin/sh", "-c", "cp -r /src/resources/* /src"}).
		WithExec([]string{"/bin/sh", "-c", "ls -al /src && ls -a /src/resources"}).
		WithExec([]string{"/bin/sh", "-c", `WINEPATH=$(winepath /src/wix3) wine heat dir /src -platform x64 -sw5150 -srd -cg GrafanaX64 -gg -sfrag -dr GrafanaX64Dir -template fragment -out $(winepath -w grafana.wxs)`}).
		WithExec([]string{"winepath"}).
		WithExec([]string{"mkdir", "/root/.wine/drive_c/temp"})

	for _, name := range []string{
		"grafana-service.wxs",
		"grafana-firewall.wxs",
		"grafana.wxs",
		"grafana-product.wxs",
	} {
		builder = builder.WithExec([]string{"/bin/sh", "-c", fmt.Sprintf(`WINEPATH=$(winepath /src/wix3) wine candle -ext WixFirewallExtension -ext WixUtilExtension -v -arch x64 $(winepath -w %s)`, name)})
	}
	builder = builder.
		WithExec([]string{"/bin/bash", "-c", "WINEPATH=$(winepath /src/wix3) wine light -cultures:en-US -ext WixUIExtension.dll -ext WixFirewallExtension -ext WixUtilExtension -v -sval -spdb grafana-service.wixobj grafana-firewall.wixobj grafana.wixobj grafana-product.wixobj -out $(winepath -w /src/grafana.msi)"})

	return builder.File("/src/grafana.msi"), nil
}
