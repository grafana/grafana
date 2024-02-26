package schemas

import (
    "cuelang.org/go/cue"
    "cuelang.org/go/cue/cuecontext"
)

type ComposableKind struct {
    Name string
    Maturity string
    CueFile cue.Value
}

func GetComposableKinds() ([]ComposableKind, error) {
    ctx := cuecontext.New()
    kinds := make([]ComposableKind, 0)
    
    azuremonitorCue, err := loadCueFile(ctx, "./public/plugins/datasource/azuremonitor/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "azuremonitor",
        Maturity: "experimental",
        CueFile: azuremonitorCue,
    })
    
    googlecloudmonitoringCue, err := loadCueFile(ctx, "./public/plugins/datasource/cloud-monitoring/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "googlecloudmonitoring",
        Maturity: "experimental",
        CueFile: googlecloudmonitoringCue,
    })
    
    cloudwatchCue, err := loadCueFile(ctx, "./public/plugins/datasource/cloudwatch/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "cloudwatch",
        Maturity: "experimental",
        CueFile: cloudwatchCue,
    })
    
    elasticsearchCue, err := loadCueFile(ctx, "./public/plugins/datasource/elasticsearch/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "elasticsearch",
        Maturity: "experimental",
        CueFile: elasticsearchCue,
    })
    
    grafanapyroscopeCue, err := loadCueFile(ctx, "./public/plugins/datasource/grafana-pyroscope-datasource/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "grafanapyroscope",
        Maturity: "experimental",
        CueFile: grafanapyroscopeCue,
    })
    
    grafanatestdatadatasourceCue, err := loadCueFile(ctx, "./public/plugins/datasource/grafana-testdata-datasource/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "grafanatestdatadatasource",
        Maturity: "experimental",
        CueFile: grafanatestdatadatasourceCue,
    })
    
    lokiCue, err := loadCueFile(ctx, "./public/plugins/datasource/loki/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "loki",
        Maturity: "experimental",
        CueFile: lokiCue,
    })
    
    parcaCue, err := loadCueFile(ctx, "./public/plugins/datasource/parca/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "parca",
        Maturity: "experimental",
        CueFile: parcaCue,
    })
    
    prometheusCue, err := loadCueFile(ctx, "./public/plugins/datasource/prometheus/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "prometheus",
        Maturity: "experimental",
        CueFile: prometheusCue,
    })
    
    tempoCue, err := loadCueFile(ctx, "./public/plugins/datasource/tempo/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "tempo",
        Maturity: "experimental",
        CueFile: tempoCue,
    })
    
    alertgroupsCue, err := loadCueFile(ctx, "./public/plugins/panel/alertGroups/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "alertgroups",
        Maturity: "experimental",
        CueFile: alertgroupsCue,
    })
    
    annolistCue, err := loadCueFile(ctx, "./public/plugins/panel/annolist/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "annolist",
        Maturity: "experimental",
        CueFile: annolistCue,
    })
    
    barchartCue, err := loadCueFile(ctx, "./public/plugins/panel/barchart/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "barchart",
        Maturity: "experimental",
        CueFile: barchartCue,
    })
    
    bargaugeCue, err := loadCueFile(ctx, "./public/plugins/panel/bargauge/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "bargauge",
        Maturity: "experimental",
        CueFile: bargaugeCue,
    })
    
    candlestickCue, err := loadCueFile(ctx, "./public/plugins/panel/candlestick/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "candlestick",
        Maturity: "experimental",
        CueFile: candlestickCue,
    })
    
    canvasCue, err := loadCueFile(ctx, "./public/plugins/panel/canvas/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "canvas",
        Maturity: "experimental",
        CueFile: canvasCue,
    })
    
    dashlistCue, err := loadCueFile(ctx, "./public/plugins/panel/dashlist/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "dashlist",
        Maturity: "experimental",
        CueFile: dashlistCue,
    })
    
    datagridCue, err := loadCueFile(ctx, "./public/plugins/panel/datagrid/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "datagrid",
        Maturity: "experimental",
        CueFile: datagridCue,
    })
    
    debugCue, err := loadCueFile(ctx, "./public/plugins/panel/debug/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "debug",
        Maturity: "experimental",
        CueFile: debugCue,
    })
    
    gaugeCue, err := loadCueFile(ctx, "./public/plugins/panel/gauge/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "gauge",
        Maturity: "experimental",
        CueFile: gaugeCue,
    })
    
    geomapCue, err := loadCueFile(ctx, "./public/plugins/panel/geomap/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "geomap",
        Maturity: "experimental",
        CueFile: geomapCue,
    })
    
    heatmapCue, err := loadCueFile(ctx, "./public/plugins/panel/heatmap/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "heatmap",
        Maturity: "experimental",
        CueFile: heatmapCue,
    })
    
    histogramCue, err := loadCueFile(ctx, "./public/plugins/panel/histogram/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "histogram",
        Maturity: "experimental",
        CueFile: histogramCue,
    })
    
    logsCue, err := loadCueFile(ctx, "./public/plugins/panel/logs/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "logs",
        Maturity: "experimental",
        CueFile: logsCue,
    })
    
    newsCue, err := loadCueFile(ctx, "./public/plugins/panel/news/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "news",
        Maturity: "experimental",
        CueFile: newsCue,
    })
    
    nodegraphCue, err := loadCueFile(ctx, "./public/plugins/panel/nodeGraph/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "nodegraph",
        Maturity: "experimental",
        CueFile: nodegraphCue,
    })
    
    piechartCue, err := loadCueFile(ctx, "./public/plugins/panel/piechart/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "piechart",
        Maturity: "experimental",
        CueFile: piechartCue,
    })
    
    statCue, err := loadCueFile(ctx, "./public/plugins/panel/stat/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "stat",
        Maturity: "experimental",
        CueFile: statCue,
    })
    
    statetimelineCue, err := loadCueFile(ctx, "./public/plugins/panel/state-timeline/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "statetimeline",
        Maturity: "experimental",
        CueFile: statetimelineCue,
    })
    
    statushistoryCue, err := loadCueFile(ctx, "./public/plugins/panel/status-history/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "statushistory",
        Maturity: "experimental",
        CueFile: statushistoryCue,
    })
    
    tableCue, err := loadCueFile(ctx, "./public/plugins/panel/table/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "table",
        Maturity: "experimental",
        CueFile: tableCue,
    })
    
    textCue, err := loadCueFile(ctx, "./public/plugins/panel/text/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "text",
        Maturity: "experimental",
        CueFile: textCue,
    })
    
    timeseriesCue, err := loadCueFile(ctx, "./public/plugins/panel/timeseries/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "timeseries",
        Maturity: "experimental",
        CueFile: timeseriesCue,
    })
    
    trendCue, err := loadCueFile(ctx, "./public/plugins/panel/trend/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "trend",
        Maturity: "experimental",
        CueFile: trendCue,
    })
    
    xychartCue, err := loadCueFile(ctx, "./public/plugins/panel/xychart/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "xychart",
        Maturity: "experimental",
        CueFile: xychartCue,
    })
    
    return kinds, nil
}
