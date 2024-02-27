package schemas

import (
    "cuelang.org/go/cue"
    "cuelang.org/go/cue/cuecontext"
)

type ComposableKind struct {
    Name string
    Filename string
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
        Filename: "dataquery.cue",
        CueFile: azuremonitorCue,
    })
    
    googlecloudmonitoringCue, err := loadCueFile(ctx, "./public/plugins/datasource/cloud-monitoring/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "googlecloudmonitoring",
        Filename: "dataquery.cue",
        CueFile: googlecloudmonitoringCue,
    })
    
    cloudwatchCue, err := loadCueFile(ctx, "./public/plugins/datasource/cloudwatch/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "cloudwatch",
        Filename: "dataquery.cue",
        CueFile: cloudwatchCue,
    })
    
    elasticsearchCue, err := loadCueFile(ctx, "./public/plugins/datasource/elasticsearch/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "elasticsearch",
        Filename: "dataquery.cue",
        CueFile: elasticsearchCue,
    })
    
    grafanapyroscopeCue, err := loadCueFile(ctx, "./public/plugins/datasource/grafana-pyroscope-datasource/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "grafanapyroscope",
        Filename: "dataquery.cue",
        CueFile: grafanapyroscopeCue,
    })
    
    grafanatestdatadatasourceCue, err := loadCueFile(ctx, "./public/plugins/datasource/grafana-testdata-datasource/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "grafanatestdatadatasource",
        Filename: "dataquery.cue",
        CueFile: grafanatestdatadatasourceCue,
    })
    
    lokiCue, err := loadCueFile(ctx, "./public/plugins/datasource/loki/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "loki",
        Filename: "dataquery.cue",
        CueFile: lokiCue,
    })
    
    parcaCue, err := loadCueFile(ctx, "./public/plugins/datasource/parca/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "parca",
        Filename: "dataquery.cue",
        CueFile: parcaCue,
    })
    
    prometheusCue, err := loadCueFile(ctx, "./public/plugins/datasource/prometheus/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "prometheus",
        Filename: "dataquery.cue",
        CueFile: prometheusCue,
    })
    
    tempoCue, err := loadCueFile(ctx, "./public/plugins/datasource/tempo/dataquery.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "tempo",
        Filename: "dataquery.cue",
        CueFile: tempoCue,
    })
    
    alertgroupsCue, err := loadCueFile(ctx, "./public/plugins/panel/alertGroups/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "alertgroups",
        Filename: "panelcfg.cue",
        CueFile: alertgroupsCue,
    })
    
    annolistCue, err := loadCueFile(ctx, "./public/plugins/panel/annolist/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "annolist",
        Filename: "panelcfg.cue",
        CueFile: annolistCue,
    })
    
    barchartCue, err := loadCueFile(ctx, "./public/plugins/panel/barchart/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "barchart",
        Filename: "panelcfg.cue",
        CueFile: barchartCue,
    })
    
    bargaugeCue, err := loadCueFile(ctx, "./public/plugins/panel/bargauge/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "bargauge",
        Filename: "panelcfg.cue",
        CueFile: bargaugeCue,
    })
    
    candlestickCue, err := loadCueFile(ctx, "./public/plugins/panel/candlestick/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "candlestick",
        Filename: "panelcfg.cue",
        CueFile: candlestickCue,
    })
    
    canvasCue, err := loadCueFile(ctx, "./public/plugins/panel/canvas/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "canvas",
        Filename: "panelcfg.cue",
        CueFile: canvasCue,
    })
    
    dashlistCue, err := loadCueFile(ctx, "./public/plugins/panel/dashlist/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "dashlist",
        Filename: "panelcfg.cue",
        CueFile: dashlistCue,
    })
    
    datagridCue, err := loadCueFile(ctx, "./public/plugins/panel/datagrid/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "datagrid",
        Filename: "panelcfg.cue",
        CueFile: datagridCue,
    })
    
    debugCue, err := loadCueFile(ctx, "./public/plugins/panel/debug/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "debug",
        Filename: "panelcfg.cue",
        CueFile: debugCue,
    })
    
    gaugeCue, err := loadCueFile(ctx, "./public/plugins/panel/gauge/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "gauge",
        Filename: "panelcfg.cue",
        CueFile: gaugeCue,
    })
    
    geomapCue, err := loadCueFile(ctx, "./public/plugins/panel/geomap/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "geomap",
        Filename: "panelcfg.cue",
        CueFile: geomapCue,
    })
    
    heatmapCue, err := loadCueFile(ctx, "./public/plugins/panel/heatmap/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "heatmap",
        Filename: "panelcfg.cue",
        CueFile: heatmapCue,
    })
    
    histogramCue, err := loadCueFile(ctx, "./public/plugins/panel/histogram/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "histogram",
        Filename: "panelcfg.cue",
        CueFile: histogramCue,
    })
    
    logsCue, err := loadCueFile(ctx, "./public/plugins/panel/logs/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "logs",
        Filename: "panelcfg.cue",
        CueFile: logsCue,
    })
    
    newsCue, err := loadCueFile(ctx, "./public/plugins/panel/news/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "news",
        Filename: "panelcfg.cue",
        CueFile: newsCue,
    })
    
    nodegraphCue, err := loadCueFile(ctx, "./public/plugins/panel/nodeGraph/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "nodegraph",
        Filename: "panelcfg.cue",
        CueFile: nodegraphCue,
    })
    
    piechartCue, err := loadCueFile(ctx, "./public/plugins/panel/piechart/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "piechart",
        Filename: "panelcfg.cue",
        CueFile: piechartCue,
    })
    
    statCue, err := loadCueFile(ctx, "./public/plugins/panel/stat/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "stat",
        Filename: "panelcfg.cue",
        CueFile: statCue,
    })
    
    statetimelineCue, err := loadCueFile(ctx, "./public/plugins/panel/state-timeline/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "statetimeline",
        Filename: "panelcfg.cue",
        CueFile: statetimelineCue,
    })
    
    statushistoryCue, err := loadCueFile(ctx, "./public/plugins/panel/status-history/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "statushistory",
        Filename: "panelcfg.cue",
        CueFile: statushistoryCue,
    })
    
    tableCue, err := loadCueFile(ctx, "./public/plugins/panel/table/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "table",
        Filename: "panelcfg.cue",
        CueFile: tableCue,
    })
    
    textCue, err := loadCueFile(ctx, "./public/plugins/panel/text/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "text",
        Filename: "panelcfg.cue",
        CueFile: textCue,
    })
    
    timeseriesCue, err := loadCueFile(ctx, "./public/plugins/panel/timeseries/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "timeseries",
        Filename: "panelcfg.cue",
        CueFile: timeseriesCue,
    })
    
    trendCue, err := loadCueFile(ctx, "./public/plugins/panel/trend/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "trend",
        Filename: "panelcfg.cue",
        CueFile: trendCue,
    })
    
    xychartCue, err := loadCueFile(ctx, "./public/plugins/panel/xychart/panelcfg.cue")
    if err != nil {
        return nil, err
    }
    kinds = append(kinds, ComposableKind{
        Name: "xychart",
        Filename: "panelcfg.cue",
        CueFile: xychartCue,
    })
    
    return kinds, nil
}
