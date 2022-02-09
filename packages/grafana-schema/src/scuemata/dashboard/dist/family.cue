package dist

import (
    "github.com/grafana/grafana/packages/grafana-schema/src/scuemata/dashboard"
    pbarchart "github.com/grafana/grafana/public/app/plugins/panel/barchart:grafanaschema"
    pbargauge "github.com/grafana/grafana/public/app/plugins/panel/bargauge:grafanaschema"
    pcanvas "github.com/grafana/grafana/public/app/plugins/panel/canvas:grafanaschema"
    pdashlist "github.com/grafana/grafana/public/app/plugins/panel/dashlist:grafanaschema"
    pgauge "github.com/grafana/grafana/public/app/plugins/panel/gauge:grafanaschema"
    phistogram "github.com/grafana/grafana/public/app/plugins/panel/histogram:grafanaschema"
    pcandlestick "github.com/grafana/grafana/public/app/plugins/panel/candlestick:grafanaschema"
    pnews "github.com/grafana/grafana/public/app/plugins/panel/news:grafanaschema"
    pstat "github.com/grafana/grafana/public/app/plugins/panel/stat:grafanaschema"
    st "github.com/grafana/grafana/public/app/plugins/panel/state-timeline:grafanaschema"
    sh "github.com/grafana/grafana/public/app/plugins/panel/status-history:grafanaschema"
    ptable "github.com/grafana/grafana/public/app/plugins/panel/table:grafanaschema"
    ptext "github.com/grafana/grafana/public/app/plugins/panel/text:grafanaschema"
    ptimeseries "github.com/grafana/grafana/public/app/plugins/panel/timeseries:grafanaschema"
)

// Family composes the base dashboard scuemata family with all Grafana core plugins -
// the plugins that are dist[ributed] with Grafana. The resulting composed scuemata is
// exactly equivalent to what's produced by the DistDashboardFamily() Go function.
//
// CUE programs should default to importing this dist variant over the base variant.
Family: dashboard.Family & {
    compose: Panel: {
        // TODO do this with a loop once we include the panel type/plugin id in the model
        barchart: pbarchart.Panel
        bargauge: pbargauge.Panel
        canvas: pcanvas.Panel
        dashlist: pdashlist.Panel
        gauge: pgauge.Panel
        histogram: phistogram.Panel
        candlestick: pcandlestick.Panel
        news: pnews.Panel
        stat: pstat.Panel
        "state-timeline": st.Panel
        "status-history": sh.Panel
        text: ptext.Panel
        table: ptable.Panel
        timeseries: ptimeseries.Panel
    }
}