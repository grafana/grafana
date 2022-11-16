import { PluginType, PluginState, PluginSignatureStatus } from '@grafana/data';

import { cdnHost } from './features/plugins/pluginCDN';

const baseUrl = 'plugin-cdn';

const dummyPanel = {
  info: {
    author: {
      name: 'Grafana Labs',
      url: 'https://grafana.com',
    },
    links: [
      {
        name: 'Project site',
        url: 'https://github.com/grafana/clock-panel',
      },
      {
        name: 'MIT License',
        url: 'https://github.com/grafana/clock-panel/blob/master/LICENSE',
      },
    ],
    build: {
      time: 1657138674187,
      repo: 'https://github.com/grafana/clock-panel',
      branch: 'master',
      hash: 'dfcdaf668efc3a5a5845b245313832b2eaa8df2f',
    },
    screenshots: [
      {
        name: 'Showcase',
        path: `/img/screenshot-showcase.png`,
      },
      {
        name: 'Options',
        path: `/img/screenshot-clock-options.png`,
      },
    ],
    updated: '2022-07-06',
  },
  hideFromList: false,
  sort: 100,
  skipDataQuery: false,
  state: PluginState.stable,
  signature: PluginSignatureStatus.valid,
  type: PluginType.panel,
};

const dummyData = [
  {
    id: 'grafana-worldmap-panel',
    name: 'Worldmap Panel',
    info: {
      description:
        'World Map panel for Grafana. Displays time series data or geohash data from Elasticsearch overlaid on a world map.',
      logos: {
        small: `${cdnHost}/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/img/logo.svg`,
        large: `${cdnHost}/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/img/logo.svg`,
      },
      version: '0.3.3',
    },
    baseUrl: `${baseUrl}/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel`,
    module: `${baseUrl}/grafana-worldmap-panel/0.3.3/public/plugins/grafana-worldmap-panel/module`,
  },
  {
    id: 'grafana-clock-panel',
    name: 'Clock',
    info: {
      description: 'Clock panel for grafana',
      logos: {
        small: `${cdnHost}/grafana-clock-panel/2.1.0/public/plugins/grafana-clock-panel/img/logo.svg`,
        large: `${cdnHost}/grafana-clock-panel/2.1.0/public/plugins/grafana-clock-panel/img/logo.svg`,
      },
      version: '2.1.0',
    },
    baseUrl: `${baseUrl}/grafana-clock-panel/2.1.0/public/plugins/grafana-clock-panel`,
    module: `${baseUrl}/grafana-clock-panel/2.1.0/public/plugins/grafana-clock-panel/module`,
  },
  {
    id: 'alertlist',
    name: 'Alert list',
    info: {
      description: 'Shows list of alerts and their current status',
      logos: {
        small: `${cdnHost}/alertlist/5.0.0/public/plugins/alertlist/img/logo.svg`,
        large: `${cdnHost}/alertlist/5.0.0/public/plugins/alertlist/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/alertlist/5.0.0/public/plugins/alertlist`,
    module: `${baseUrl}/alertlist/5.0.0/public/plugins/alertlist/module`,
  },
  {
    id: 'annolist',
    name: 'Annotations list',
    info: {
      description: 'List annotations',
      logos: {
        small: `${cdnHost}/annolist/5.0.0/public/plugins/annolist/img/logo.svg`,
        large: `${cdnHost}/annolist/5.0.0/public/plugins/annolist/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/annolist/5.0.0/public/plugins/annolist`,
    module: `${baseUrl}/annolist/5.0.0/public/plugins/annolist/module`,
  },
  {
    id: 'barchart',
    name: 'Bar chart',
    info: {
      description: 'Categorical charts with group support',
      logos: {
        small: `${cdnHost}/barchart/5.0.0/public/plugins/barchart/img/logo.svg`,
        large: `${cdnHost}/barchart/5.0.0/public/plugins/barchart/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/barchart/5.0.0/public/plugins/barchart`,
    module: `${baseUrl}/barchart/5.0.0/public/plugins/barchart/module`,
  },
  {
    id: 'bargauge',
    name: 'Bar gauge',
    info: {
      description: 'Horizontal and vertical gauges',
      logos: {
        small: `${cdnHost}/bargauge/5.0.0/public/plugins/bargauge/img/logo.svg`,
        large: `${cdnHost}/bargauge/5.0.0/public/plugins/bargauge/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/bargauge/5.0.0/public/plugins/bargauge`,
    module: `${baseUrl}/bargauge/5.0.0/public/plugins/bargauge/module`,
  },
  {
    id: 'candlestick',
    name: 'Candlestick',
    info: {
      description: '',
      logos: {
        small: `${cdnHost}/candlestick/5.0.0/public/plugins/candlestick/img/logo.svg`,
        large: `${cdnHost}/candlestick/5.0.0/public/plugins/candlestick/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/candlestick/5.0.0/public/plugins/candlestick`,
    module: `${baseUrl}/candlestick/5.0.0/public/plugins/candlestick/module`,
  },
  {
    id: 'canvas',
    name: 'Canvas',
    info: {
      description: 'Explicit element placement',
      logos: {
        small: `${cdnHost}/canvas/5.0.0/public/plugins/canvas/img/logo.svg`,
        large: `${cdnHost}/canvas/5.0.0/public/plugins/canvas/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/canvas/5.0.0/public/plugins/canvas`,
    module: `${baseUrl}/canvas/5.0.0/public/plugins/canvas/module`,
  },
  {
    id: 'dashlist',
    name: 'Dashboard list',
    info: {
      description: 'List of dynamic links to other dashboards',
      logos: {
        small: `${cdnHost}/dashlist/5.0.0/public/plugins/dashlist/img/logo.svg`,
        large: `${cdnHost}/dashlist/5.0.0/public/plugins/dashlist/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/dashlist/5.0.0/public/plugins/dashlist`,
    module: `${baseUrl}/dashlist/5.0.0/public/plugins/dashlist/module`,
  },
  {
    id: 'debug',
    name: 'Debug',
    info: {
      description: 'Debug Panel for Grafana',
      logos: {
        small: `${cdnHost}/debug/5.0.0/public/plugins/debug/img/logo.svg`,
        large: `${cdnHost}/debug/5.0.0/public/plugins/debug/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/debug/5.0.0/public/plugins/debug`,
    module: `${baseUrl}/debug/5.0.0/public/plugins/debug/module`,
  },
  {
    id: 'gauge',
    name: 'Gauge',
    info: {
      description: 'Standard gauge visualization',
      logos: {
        small: `${cdnHost}/gauge/5.0.0/public/plugins/gauge/img/logo.svg`,
        large: `${cdnHost}/gauge/5.0.0/public/plugins/gauge/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/gauge/5.0.0/public/plugins/gauge`,
    module: `${baseUrl}/gauge/5.0.0/public/plugins/gauge/module`,
  },
  {
    id: 'geomap',
    name: 'Geomap',
    info: {
      description: 'Geomap panel',
      logos: {
        small: `${cdnHost}/geomap/5.0.0/public/plugins/geomap/img/logo.svg`,
        large: `${cdnHost}/geomap/5.0.0/public/plugins/geomap/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/geomap/5.0.0/public/plugins/geomap`,
    module: `${baseUrl}/geomap/5.0.0/public/plugins/geomap/module`,
  },
  {
    id: 'graph',
    name: 'Graph (old)',
    info: {
      description: 'The old default graph panel',
      logos: {
        small: `${cdnHost}/graph/5.0.0/public/plugins/graph/img/logo.svg`,
        large: `${cdnHost}/graph/5.0.0/public/plugins/graph/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/graph/5.0.0/public/plugins/graph`,
    module: `${baseUrl}/graph/5.0.0/public/plugins/graph/module`,
  },
  {
    id: 'heatmap',
    name: 'Heatmap',
    info: {
      description: 'Heatmap Panel for Grafana',
      logos: {
        small: `${cdnHost}/heatmap/5.0.0/public/plugins/heatmap/img/logo.svg`,
        large: `${cdnHost}/heatmap/5.0.0/public/plugins/heatmap/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/heatmap/5.0.0/public/plugins/heatmap`,
    module: `${baseUrl}/heatmap/5.0.0/public/plugins/heatmap/module`,
  },
  {
    id: 'heatmap-new',
    name: 'Heatmap (new)',
    info: {
      description: 'This heatmap panel will replace the heatmap panel in 9.1',
      logos: {
        small: `${cdnHost}/heatmap-new/5.0.0/public/plugins/heatmap-new/img/logo.svg`,
        large: `${cdnHost}/heatmap-new/5.0.0/public/plugins/heatmap-new/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/heatmap-new/5.0.0/public/plugins/heatmap-new`,
    module: `${baseUrl}/heatmap-new/5.0.0/public/plugins/heatmap-new/module`,
  },
  {
    id: 'histogram',
    name: 'Histogram',
    info: {
      description: '',
      logos: {
        small: `${cdnHost}/histogram/5.0.0/public/plugins/histogram/img/logo.svg`,
        large: `${cdnHost}/histogram/5.0.0/public/plugins/histogram/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/histogram/5.0.0/public/plugins/histogram`,
    module: `${baseUrl}/histogram/5.0.0/public/plugins/histogram/module`,
  },
  {
    id: 'singlestat',
    name: 'Singlestat',
    info: {
      description: 'Singlestat Panel for Grafana',
      logos: {
        small: `${cdnHost}/singlestat/5.0.0/public/plugins/singlestat/img/logo.svg`,
        large: `${cdnHost}/singlestat/5.0.0/public/plugins/singlestat/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/singlestat/5.0.0/public/plugins/singlestat`,
    module: `${baseUrl}/singlestat/5.0.0/public/plugins/singlestat/module`,
  },
  {
    id: 'stat',
    name: 'Stat',
    info: {
      description: 'Big stat values & sparklines',
      logos: {
        small: `${cdnHost}/stat/5.0.0/public/plugins/stat/img/logo.svg`,
        large: `${cdnHost}/stat/5.0.0/public/plugins/stat/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/stat/5.0.0/public/plugins/stat`,
    module: `${baseUrl}/stat/5.0.0/public/plugins/stat/module`,
  },
  {
    id: 'table',
    name: 'Table',
    info: {
      description: 'Supports many column styles',
      logos: {
        small: `${cdnHost}/table/5.0.0/public/plugins/table/img/logo.svg`,
        large: `${cdnHost}/table/5.0.0/public/plugins/table/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/table/5.0.0/public/plugins/table`,
    module: `${baseUrl}/table/5.0.0/public/plugins/table/module`,
  },
  {
    id: 'text',
    name: 'Text',
    info: {
      description: 'Supports markdown and html content',
      logos: {
        small: `${cdnHost}/text/5.0.0/public/plugins/text/img/logo.svg`,
        large: `${cdnHost}/text/5.0.0/public/plugins/text/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/text/5.0.0/public/plugins/text`,
    module: `${baseUrl}/text/5.0.0/public/plugins/text/module`,
  },
  {
    id: 'timeseries',
    name: 'Time series',
    info: {
      description: 'Time based line, area and bar charts',
      logos: {
        small: `${cdnHost}/timeseries/5.0.0/public/plugins/timeseries/img/logo.svg`,
        large: `${cdnHost}/timeseries/5.0.0/public/plugins/timeseries/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/timeseries/5.0.0/public/plugins/timeseries`,
    module: `${baseUrl}/timeseries/5.0.0/public/plugins/timeseries/module`,
  },
  {
    id: 'xychart',
    name: 'XY Chart',
    info: {
      description: '',
      logos: {
        small: `${cdnHost}/xychart/5.0.0/public/plugins/xychart/img/logo.svg`,
        large: `${cdnHost}/xychart/5.0.0/public/plugins/xychart/img/logo.svg`,
      },
      version: '5.0.0',
    },
    baseUrl: `${baseUrl}/xychart/5.0.0/public/plugins/xychart`,
    module: `${baseUrl}/xychart/5.0.0/public/plugins/xychart/module`,
  },
  {
    id: 'satellogic-3d-globe-panel',
    name: '3D Globe Panel',
    info: {
      description: 'A Cesium based 3D Globe panel plugin.',
      logos: {
        small: `${cdnHost}/satellogic-3d-globe-panel/0.1.1/public/plugins/satellogic-3d-globe-panel/img/logo.svg`,
        large: `${cdnHost}/satellogic-3d-globe-panel/0.1.1/public/plugins/satellogic-3d-globe-panel/img/logo.svg`,
      },
      version: '0.1.1',
    },
    baseUrl: `${baseUrl}/satellogic-3d-globe-panel/0.1.1/public/plugins/satellogic-3d-globe-panel`,
    module: `${baseUrl}/satellogic-3d-globe-panel/0.1.1/public/plugins/satellogic-3d-globe-panel/module`,
  },
  {
    id: 'aceiot-svg-panel',
    name: 'ACE.SVG',
    info: {
      description: 'SVG Visualization Panel',
      logos: {
        small: `${cdnHost}/aceiot-svg-panel/0.0.11/public/plugins/aceiot-svg-panel/img/logo.svg`,
        large: `${cdnHost}/aceiot-svg-panel/0.0.11/public/plugins/aceiot-svg-panel/img/logo.svg`,
      },
      version: '0.0.11',
    },
    baseUrl: `${baseUrl}/aceiot-svg-panel/0.0.11/public/plugins/aceiot-svg-panel`,
    module: `${baseUrl}/aceiot-svg-panel/0.0.11/public/plugins/aceiot-svg-panel/module`,
  },
  {
    id: 'ryantxu-ajax-panel',
    name: 'AJAX',
    info: {
      description: 'AJAX panel for grafana',
      logos: {
        small: `${cdnHost}/ryantxu-ajax-panel/0.1.0/public/plugins/ryantxu-ajax-panel/img/logo.svg`,
        large: `${cdnHost}/ryantxu-ajax-panel/0.1.0/public/plugins/ryantxu-ajax-panel/img/logo.svg`,
      },
      version: '0.1.0',
    },
    baseUrl: `${baseUrl}/ryantxu-ajax-panel/0.1.0/public/plugins/ryantxu-ajax-panel`,
    module: `${baseUrl}/ryantxu-ajax-panel/0.1.0/public/plugins/ryantxu-ajax-panel/module`,
  },
  {
    id: 'macropower-analytics-panel',
    name: 'Analytics Panel',
    info: {
      description: "It's like Google Analytics, but for Grafana dashboards!",
      logos: {
        small: `${cdnHost}/macropower-analytics-panel/2.1.0/public/plugins/macropower-analytics-panel/img/logo.svg`,
        large: `${cdnHost}/macropower-analytics-panel/2.1.0/public/plugins/macropower-analytics-panel/img/logo.svg`,
      },
      version: '2.1.0',
    },
    baseUrl: `${baseUrl}/macropower-analytics-panel/2.1.0/public/plugins/macropower-analytics-panel`,
    module: `${baseUrl}/macropower-analytics-panel/2.1.0/public/plugins/macropower-analytics-panel/module`,
  },
  {
    id: 'ryantxu-annolist-panel',
    name: 'Annotation List',
    info: {
      description: 'List of builtin Annotations',
      logos: {
        small: `${cdnHost}/ryantxu-annolist-panel/0.0.2/public/plugins/ryantxu-annolist-panel/img/logo.svg`,
        large: `${cdnHost}/ryantxu-annolist-panel/0.0.2/public/plugins/ryantxu-annolist-panel/img/logo.svg`,
      },
      version: '0.0.2',
    },
    baseUrl: `${baseUrl}/ryantxu-annolist-panel/0.0.2/public/plugins/ryantxu-annolist-panel`,
    module: `${baseUrl}/ryantxu-annolist-panel/0.0.2/public/plugins/ryantxu-annolist-panel/module`,
  },
  {
    id: 'novalabs-annotations-panel',
    name: 'Annotation Panel',
    info: {
      description: 'Annotations panel for Grafana',
      logos: {
        small: `${cdnHost}/novalabs-annotations-panel/0.0.2/public/plugins/novalabs-annotations-panel/img/logo.svg`,
        large: `${cdnHost}/novalabs-annotations-panel/0.0.2/public/plugins/novalabs-annotations-panel/img/logo.svg`,
      },
      version: '0.0.2',
    },
    baseUrl: `${baseUrl}/novalabs-annotations-panel/0.0.2/public/plugins/novalabs-annotations-panel`,
    module: `${baseUrl}/novalabs-annotations-panel/0.0.2/public/plugins/novalabs-annotations-panel/module`,
  },
  {
    id: 'michaeldmoore-annunciator-panel',
    name: 'Annunciator',
    info: {
      description:
        'Enhanced version of built-in SingleStat panel, with specialized display of thresholds and value-sensative presentation',
      logos: {
        small: `${cdnHost}/michaeldmoore-annunciator-panel/1.1.0/public/plugins/michaeldmoore-annunciator-panel/img/logo.svg`,
        large: `${cdnHost}/michaeldmoore-annunciator-panel/1.1.0/public/plugins/michaeldmoore-annunciator-panel/img/logo.svg`,
      },
      version: '1.1.0',
    },
    baseUrl: `${baseUrl}/michaeldmoore-annunciator-panel/1.1.0/public/plugins/michaeldmoore-annunciator-panel`,
    module: `${baseUrl}/michaeldmoore-annunciator-panel/1.1.0/public/plugins/michaeldmoore-annunciator-panel/module`,
  },
  {
    id: 'anodot-panel',
    name: 'Anodot',
    info: {
      description: 'Anodot Grafana Panel for usage together with anodot-datasource',
      logos: {
        small: `${cdnHost}/anodot-panel/2.0.1/public/plugins/anodot-panel/img/logo.svg`,
        large: `${cdnHost}/anodot-panel/2.0.1/public/plugins/anodot-panel/img/logo.svg`,
      },
      version: '2.0.1',
    },
    baseUrl: `${baseUrl}/anodot-panel/2.0.1/public/plugins/anodot-panel`,
    module: `${baseUrl}/anodot-panel/2.0.1/public/plugins/anodot-panel/module`,
  },
  {
    id: 'volkovlabs-echarts-panel',
    name: 'Apache ECharts',
    info: {
      description: 'Apache ECharts panel',
      logos: {
        small: `${cdnHost}/volkovlabs-echarts-panel/3.7.0/public/plugins/volkovlabs-echarts-panel/img/logo.svg`,
        large: `${cdnHost}/volkovlabs-echarts-panel/3.7.0/public/plugins/volkovlabs-echarts-panel/img/logo.svg`,
      },
      version: '3.7.0',
    },
    baseUrl: `${baseUrl}/volkovlabs-echarts-panel/3.7.0/public/plugins/volkovlabs-echarts-panel`,
    module: `${baseUrl}/volkovlabs-echarts-panel/3.7.0/public/plugins/volkovlabs-echarts-panel/module`,
  },
  {
    id: 'volkovlabs-image-panel',
    name: 'Base64 Image/Video/Audio/PDF',
    info: {
      description: 'Base64 Image/Video/Audio/PDF panel',
      logos: {
        small: `${cdnHost}/volkovlabs-image-panel/3.3.0/public/plugins/volkovlabs-image-panel/img/logo.svg`,
        large: `${cdnHost}/volkovlabs-image-panel/3.3.0/public/plugins/volkovlabs-image-panel/img/logo.svg`,
      },
      version: '3.3.0',
    },
    baseUrl: `${baseUrl}/volkovlabs-image-panel/3.3.0/public/plugins/volkovlabs-image-panel`,
    module: `${baseUrl}/volkovlabs-image-panel/3.3.0/public/plugins/volkovlabs-image-panel/module`,
  },
  {
    id: 'farski-blendstat-panel',
    name: 'Blendstat',
    info: {
      description: 'Blendstat Panel for Grafana',
      logos: {
        small: `${cdnHost}/farski-blendstat-panel/1.0.3/public/plugins/farski-blendstat-panel/img/logo.svg`,
        large: `${cdnHost}/farski-blendstat-panel/1.0.3/public/plugins/farski-blendstat-panel/img/logo.svg`,
      },
      version: '1.0.3',
    },
    baseUrl: `${baseUrl}/farski-blendstat-panel/1.0.3/public/plugins/farski-blendstat-panel`,
    module: `${baseUrl}/farski-blendstat-panel/1.0.3/public/plugins/farski-blendstat-panel/module`,
  },
  {
    id: 'yesoreyeram-boomtable-panel',
    name: 'Boom Table',
    info: {
      description: 'Boom table panel for Graphite, InfluxDB, Prometheus',
      logos: {
        small: `${cdnHost}/yesoreyeram-boomtable-panel/1.4.1/public/plugins/yesoreyeram-boomtable-panel/img/logo.svg`,
        large: `${cdnHost}/yesoreyeram-boomtable-panel/1.4.1/public/plugins/yesoreyeram-boomtable-panel/img/logo.svg`,
      },
      version: '1.4.1',
    },
    baseUrl: `${baseUrl}/yesoreyeram-boomtable-panel/1.4.1/public/plugins/yesoreyeram-boomtable-panel`,
    module: `${baseUrl}/yesoreyeram-boomtable-panel/1.4.1/public/plugins/yesoreyeram-boomtable-panel/module`,
  },
  {
    id: 'yesoreyeram-boomtheme-panel',
    name: 'Boom Theme',
    info: {
      description: 'Themes for Grafana',
      logos: {
        small: `${cdnHost}/yesoreyeram-boomtheme-panel/0.2.1/public/plugins/yesoreyeram-boomtheme-panel/img/logo.svg`,
        large: `${cdnHost}/yesoreyeram-boomtheme-panel/0.2.1/public/plugins/yesoreyeram-boomtheme-panel/img/logo.svg`,
      },
      version: '0.2.1',
    },
    baseUrl: `${baseUrl}/yesoreyeram-boomtheme-panel/0.2.1/public/plugins/yesoreyeram-boomtheme-panel`,
    module: `${baseUrl}/yesoreyeram-boomtheme-panel/0.2.1/public/plugins/yesoreyeram-boomtheme-panel/module`,
  },
  {
    id: 'timomyl-breadcrumb-panel',
    name: 'Breadcrumb',
    info: {
      description: 'Breadcrumb Panel for Grafana',
      logos: {
        small: `${cdnHost}/timomyl-breadcrumb-panel/1.2.0/public/plugins/timomyl-breadcrumb-panel/img/logo.svg`,
        large: `${cdnHost}/timomyl-breadcrumb-panel/1.2.0/public/plugins/timomyl-breadcrumb-panel/img/logo.svg`,
      },
      version: '1.2.0',
    },
    baseUrl: `${baseUrl}/timomyl-breadcrumb-panel/1.2.0/public/plugins/timomyl-breadcrumb-panel`,
    module: `${baseUrl}/timomyl-breadcrumb-panel/1.2.0/public/plugins/timomyl-breadcrumb-panel/module`,
  },
  {
    id: 'digrich-bubblechart-panel',
    name: 'Bubble Chart',
    info: {
      description: 'Bubblechart panel',
      logos: {
        small: `${cdnHost}/digrich-bubblechart-panel/1.2.1/public/plugins/digrich-bubblechart-panel/img/logo.svg`,
        large: `${cdnHost}/digrich-bubblechart-panel/1.2.1/public/plugins/digrich-bubblechart-panel/img/logo.svg`,
      },
      version: '1.2.1',
    },
    baseUrl: `${baseUrl}/digrich-bubblechart-panel/1.2.1/public/plugins/digrich-bubblechart-panel`,
    module: `${baseUrl}/digrich-bubblechart-panel/1.2.1/public/plugins/digrich-bubblechart-panel/module`,
  },
  {
    id: 'netsage-bumpchart-panel',
    name: 'Bump Chart Panel',
    info: {
      description: 'Bump Chart Panel Plugin',
      logos: {
        small: `${cdnHost}/netsage-bumpchart-panel/1.0.2/public/plugins/netsage-bumpchart-panel/img/logo.svg`,
        large: `${cdnHost}/netsage-bumpchart-panel/1.0.2/public/plugins/netsage-bumpchart-panel/img/logo.svg`,
      },
      version: '1.0.2',
    },
    baseUrl: `${baseUrl}/netsage-bumpchart-panel/1.0.2/public/plugins/netsage-bumpchart-panel`,
    module: `${baseUrl}/netsage-bumpchart-panel/1.0.2/public/plugins/netsage-bumpchart-panel/module`,
  },
  {
    id: 'speakyourcode-button-panel',
    name: 'Button',
    info: {
      description: 'Button Control Panel',
      logos: {
        small: `${cdnHost}/speakyourcode-button-panel/0.2.2/public/plugins/speakyourcode-button-panel/img/logo.svg`,
        large: `${cdnHost}/speakyourcode-button-panel/0.2.2/public/plugins/speakyourcode-button-panel/img/logo.svg`,
      },
      version: '0.2.2',
    },
    baseUrl: `${baseUrl}/speakyourcode-button-panel/0.2.2/public/plugins/speakyourcode-button-panel`,
    module: `${baseUrl}/speakyourcode-button-panel/0.2.2/public/plugins/speakyourcode-button-panel/module`,
  },
  {
    id: 'cloudspout-button-panel',
    name: 'Button Panel',
    info: {
      description: 'Panel for a single button',
      logos: {
        small: `${cdnHost}/cloudspout-button-panel/7.0.23/public/plugins/cloudspout-button-panel/img/logo.svg`,
        large: `${cdnHost}/cloudspout-button-panel/7.0.23/public/plugins/cloudspout-button-panel/img/logo.svg`,
      },
      version: '7.0.23',
    },
    baseUrl: `${baseUrl}/cloudspout-button-panel/7.0.23/public/plugins/cloudspout-button-panel`,
    module: `${baseUrl}/cloudspout-button-panel/7.0.23/public/plugins/cloudspout-button-panel/module`,
  },
  {
    id: 'neocat-cal-heatmap-panel',
    name: 'Cal-HeatMap',
    info: {
      description: 'Cal-HeatMap panel for Grafana',
      logos: {
        small: `${cdnHost}/neocat-cal-heatmap-panel/0.0.4/public/plugins/neocat-cal-heatmap-panel/img/logo.svg`,
        large: `${cdnHost}/neocat-cal-heatmap-panel/0.0.4/public/plugins/neocat-cal-heatmap-panel/img/logo.svg`,
      },
      version: '0.0.4',
    },
    baseUrl: `${baseUrl}/neocat-cal-heatmap-panel/0.0.4/public/plugins/neocat-cal-heatmap-panel`,
    module: `${baseUrl}/neocat-cal-heatmap-panel/0.0.4/public/plugins/neocat-cal-heatmap-panel/module`,
  },
  {
    id: 'marcusolsson-calendar-panel',
    name: 'Calendar',
    info: {
      description: 'Display events and set time range',
      logos: {
        small: `${cdnHost}/marcusolsson-calendar-panel/1.0.0/public/plugins/marcusolsson-calendar-panel/img/logo.svg`,
        large: `${cdnHost}/marcusolsson-calendar-panel/1.0.0/public/plugins/marcusolsson-calendar-panel/img/logo.svg`,
      },
      version: '1.0.0',
    },
    baseUrl: `${baseUrl}/marcusolsson-calendar-panel/1.0.0/public/plugins/marcusolsson-calendar-panel`,
    module: `${baseUrl}/marcusolsson-calendar-panel/1.0.0/public/plugins/marcusolsson-calendar-panel/module`,
  },
  {
    id: 'petrslavotinek-carpetplot-panel',
    name: 'Carpet plot',
    info: {
      description: 'Carpet plot panel plugin for grafana',
      logos: {
        small: `${cdnHost}/petrslavotinek-carpetplot-panel/0.1.2/public/plugins/petrslavotinek-carpetplot-panel/img/logo.svg`,
        large: `${cdnHost}/petrslavotinek-carpetplot-panel/0.1.2/public/plugins/petrslavotinek-carpetplot-panel/img/logo.svg`,
      },
      version: '0.1.2',
    },
    baseUrl: `${baseUrl}/petrslavotinek-carpetplot-panel/0.1.2/public/plugins/petrslavotinek-carpetplot-panel`,
    module: `${baseUrl}/petrslavotinek-carpetplot-panel/0.1.2/public/plugins/petrslavotinek-carpetplot-panel/module`,
  },
  {
    id: 'sebastiangunreben-cdf-panel',
    name: 'CDF - Cumulative Distribution Function',
    info: {
      description: 'Panel for CDF visualizations',
      logos: {
        small: `${cdnHost}/sebastiangunreben-cdf-panel/0.2.4/public/plugins/sebastiangunreben-cdf-panel/img/logo.svg`,
        large: `${cdnHost}/sebastiangunreben-cdf-panel/0.2.4/public/plugins/sebastiangunreben-cdf-panel/img/logo.svg`,
      },
      version: '0.2.4',
    },
    baseUrl: `${baseUrl}/sebastiangunreben-cdf-panel/0.2.4/public/plugins/sebastiangunreben-cdf-panel`,
    module: `${baseUrl}/sebastiangunreben-cdf-panel/0.2.4/public/plugins/sebastiangunreben-cdf-panel/module`,
  },
  {
    id: 'corpglory-chartwerk-panel',
    name: 'Chartwerk',
    info: {
      description: 'Chartwerk panel with extended chart customization',
      logos: {
        small: `${cdnHost}/corpglory-chartwerk-panel/0.5.0/public/plugins/corpglory-chartwerk-panel/img/logo.svg`,
        large: `${cdnHost}/corpglory-chartwerk-panel/0.5.0/public/plugins/corpglory-chartwerk-panel/img/logo.svg`,
      },
      version: '0.5.0',
    },
    baseUrl: `${baseUrl}/corpglory-chartwerk-panel/0.5.0/public/plugins/corpglory-chartwerk-panel`,
    module: `${baseUrl}/corpglory-chartwerk-panel/0.5.0/public/plugins/corpglory-chartwerk-panel/module`,
  },
  {
    id: 'snuids-svg-panel',
    name: 'Colored SVG Panel',
    info: {
      description: 'A panel that displays values as colored svg images',
      logos: {
        small: `${cdnHost}/snuids-svg-panel/1.0.0/public/plugins/snuids-svg-panel/img/logo.svg`,
        large: `${cdnHost}/snuids-svg-panel/1.0.0/public/plugins/snuids-svg-panel/img/logo.svg`,
      },
      version: '1.0.0',
    },
    baseUrl: `${baseUrl}/snuids-svg-panel/1.0.0/public/plugins/snuids-svg-panel`,
    module: `${baseUrl}/snuids-svg-panel/1.0.0/public/plugins/snuids-svg-panel/module`,
  },
  {
    id: 'zestairlove-compacthostmap-panel',
    name: 'Compact Hostmap Panel',
    info: {
      description: 'Grafana Compact Hostmap Panel Plugin',
      logos: {
        small: `${cdnHost}/zestairlove-compacthostmap-panel/0.9.0/public/plugins/zestairlove-compacthostmap-panel/img/logo.svg`,
        large: `${cdnHost}/zestairlove-compacthostmap-panel/0.9.0/public/plugins/zestairlove-compacthostmap-panel/img/logo.svg`,
      },
      version: '0.9.0',
    },
    baseUrl: `${baseUrl}/zestairlove-compacthostmap-panel/0.9.0/public/plugins/zestairlove-compacthostmap-panel`,
    module: `${baseUrl}/zestairlove-compacthostmap-panel/0.9.0/public/plugins/zestairlove-compacthostmap-panel/module`,
  },
  {
    id: 'integrationmatters-comparison-panel',
    name: 'Comparison Panel',
    info: {
      description: '',
      logos: {
        small: `${cdnHost}/integrationmatters-comparison-panel/1.1.0/public/plugins/integrationmatters-comparison-panel/img/logo.svg`,
        large: `${cdnHost}/integrationmatters-comparison-panel/1.1.0/public/plugins/integrationmatters-comparison-panel/img/logo.svg`,
      },
      version: '1.1.0',
    },
    baseUrl: `${baseUrl}/integrationmatters-comparison-panel/1.1.0/public/plugins/integrationmatters-comparison-panel`,
    module: `${baseUrl}/integrationmatters-comparison-panel/1.1.0/public/plugins/integrationmatters-comparison-panel/module`,
  },
  {
    id: 'briangann-gauge-panel',
    name: 'D3 Gauge',
    info: {
      description: 'D3-based Gauge panel for Grafana',
      logos: {
        small: `${cdnHost}/briangann-gauge-panel/0.0.9/public/plugins/briangann-gauge-panel/img/logo.svg`,
        large: `${cdnHost}/briangann-gauge-panel/0.0.9/public/plugins/briangann-gauge-panel/img/logo.svg`,
      },
      version: '0.0.9',
    },
    baseUrl: `${baseUrl}/briangann-gauge-panel/0.0.9/public/plugins/briangann-gauge-panel`,
    module: `${baseUrl}/briangann-gauge-panel/0.0.9/public/plugins/briangann-gauge-panel/module`,
  },
  {
    id: 'volkovlabs-form-panel',
    name: 'Data Manipulation',
    info: {
      description: 'Data Manipulation Panel',
      logos: {
        small: `${cdnHost}/volkovlabs-form-panel/2.7.0/public/plugins/volkovlabs-form-panel/img/logo.svg`,
        large: `${cdnHost}/volkovlabs-form-panel/2.7.0/public/plugins/volkovlabs-form-panel/img/logo.svg`,
      },
      version: '2.7.0',
    },
    baseUrl: `${baseUrl}/volkovlabs-form-panel/2.7.0/public/plugins/volkovlabs-form-panel`,
    module: `${baseUrl}/volkovlabs-form-panel/2.7.0/public/plugins/volkovlabs-form-panel/module`,
  },
  {
    id: 'briangann-datatable-panel',
    name: 'Datatable Panel',
    info: {
      description: 'Datatable panel for Grafana',
      logos: {
        small: `${cdnHost}/briangann-datatable-panel/1.0.3/public/plugins/briangann-datatable-panel/img/logo.svg`,
        large: `${cdnHost}/briangann-datatable-panel/1.0.3/public/plugins/briangann-datatable-panel/img/logo.svg`,
      },
      version: '1.0.3',
    },
    baseUrl: `${baseUrl}/briangann-datatable-panel/1.0.3/public/plugins/briangann-datatable-panel`,
    module: `${baseUrl}/briangann-datatable-panel/1.0.3/public/plugins/briangann-datatable-panel/module`,
  },
  {
    id: 'jdbranham-diagram-panel',
    name: 'Diagram',
    info: {
      description: 'Display diagrams and charts with colored metric indicators',
      logos: {
        small: `${cdnHost}/jdbranham-diagram-panel/1.7.3/public/plugins/jdbranham-diagram-panel/img/logo.svg`,
        large: `${cdnHost}/jdbranham-diagram-panel/1.7.3/public/plugins/jdbranham-diagram-panel/img/logo.svg`,
      },
      version: '1.7.3',
    },
    baseUrl: `${baseUrl}/jdbranham-diagram-panel/1.7.3/public/plugins/jdbranham-diagram-panel`,
    module: `${baseUrl}/jdbranham-diagram-panel/1.7.3/public/plugins/jdbranham-diagram-panel/module`,
  },
  {
    id: 'natel-discrete-panel',
    name: 'Discrete',
    info: {
      description: 'Discrete Events grafana',
      logos: {
        small: `${cdnHost}/natel-discrete-panel/0.1.1/public/plugins/natel-discrete-panel/img/logo.svg`,
        large: `${cdnHost}/natel-discrete-panel/0.1.1/public/plugins/natel-discrete-panel/img/logo.svg`,
      },
      version: '0.1.1',
    },
    baseUrl: `${baseUrl}/natel-discrete-panel/0.1.1/public/plugins/natel-discrete-panel`,
    module: `${baseUrl}/natel-discrete-panel/0.1.1/public/plugins/natel-discrete-panel/module`,
  },
  {
    id: 'dalvany-image-panel',
    name: 'Dynamic image panel',
    info: {
      description: 'Concatenate a metric to an URL in order to display an image',
      logos: {
        small: `${cdnHost}/dalvany-image-panel/2.7.0/public/plugins/dalvany-image-panel/img/logo.svg`,
        large: `${cdnHost}/dalvany-image-panel/2.7.0/public/plugins/dalvany-image-panel/img/logo.svg`,
      },
      version: '2.7.0',
    },
    baseUrl: `${baseUrl}/dalvany-image-panel/2.7.0/public/plugins/dalvany-image-panel`,
    module: `${baseUrl}/dalvany-image-panel/2.7.0/public/plugins/dalvany-image-panel/module`,
  },
  {
    id: 'marcusolsson-dynamictext-panel',
    name: 'Dynamic Text',
    info: {
      description: 'Data-driven text with Markdown and Handlebars support',
      logos: {
        small: `${cdnHost}/marcusolsson-dynamictext-panel/2.1.0/public/plugins/marcusolsson-dynamictext-panel/img/logo.svg`,
        large: `${cdnHost}/marcusolsson-dynamictext-panel/2.1.0/public/plugins/marcusolsson-dynamictext-panel/img/logo.svg`,
      },
      version: '2.1.0',
    },
    baseUrl: `${baseUrl}/marcusolsson-dynamictext-panel/2.1.0/public/plugins/marcusolsson-dynamictext-panel`,
    module: `${baseUrl}/marcusolsson-dynamictext-panel/2.1.0/public/plugins/marcusolsson-dynamictext-panel/module`,
  },
  {
    id: 'bilibala-echarts-panel',
    name: 'Echarts',
    info: {
      description: 'Echarts panel for grafana',
      logos: {
        small: `${cdnHost}/bilibala-echarts-panel/2.2.4/public/plugins/bilibala-echarts-panel/img/logo.svg`,
        large: `${cdnHost}/bilibala-echarts-panel/2.2.4/public/plugins/bilibala-echarts-panel/img/logo.svg`,
      },
      version: '2.2.4',
    },
    baseUrl: `${baseUrl}/bilibala-echarts-panel/2.2.4/public/plugins/bilibala-echarts-panel`,
    module: `${baseUrl}/bilibala-echarts-panel/2.2.4/public/plugins/bilibala-echarts-panel/module`,
  },
  {
    id: 'larona-epict-panel',
    name: 'ePict Panel',
    info: {
      description: 'Enter the URL of the image you want, and add some metrics on it.',
      logos: {
        small: `${cdnHost}/larona-epict-panel/2.0.5/public/plugins/larona-epict-panel/img/logo.svg`,
        large: `${cdnHost}/larona-epict-panel/2.0.5/public/plugins/larona-epict-panel/img/logo.svg`,
      },
      version: '2.0.5',
    },
    baseUrl: `${baseUrl}/larona-epict-panel/2.0.5/public/plugins/larona-epict-panel`,
    module: `${baseUrl}/larona-epict-panel/2.0.5/public/plugins/larona-epict-panel/module`,
  },
  {
    id: 'esnet-chord-panel',
    name: 'ESnet Chord',
    info: {
      description: 'ESnet Chord Panel Plugin for Grafana 8.3 and newer',
      logos: {
        small: `${cdnHost}/esnet-chord-panel/1.0.3/public/plugins/esnet-chord-panel/img/logo.svg`,
        large: `${cdnHost}/esnet-chord-panel/1.0.3/public/plugins/esnet-chord-panel/img/logo.svg`,
      },
      version: '1.0.3',
    },
    baseUrl: `${baseUrl}/esnet-chord-panel/1.0.3/public/plugins/esnet-chord-panel`,
    module: `${baseUrl}/esnet-chord-panel/1.0.3/public/plugins/esnet-chord-panel/module`,
  },
  {
    id: 'esnet-matrix-panel',
    name: 'ESNET Matrix Panel',
    info: {
      description: 'Matrix Panel Plugin that allows comparison of two non-timeseries categories',
      logos: {
        small: `${cdnHost}/esnet-matrix-panel/1.0.6/public/plugins/esnet-matrix-panel/img/logo.svg`,
        large: `${cdnHost}/esnet-matrix-panel/1.0.6/public/plugins/esnet-matrix-panel/img/logo.svg`,
      },
      version: '1.0.6',
    },
    baseUrl: `${baseUrl}/esnet-matrix-panel/1.0.6/public/plugins/esnet-matrix-panel`,
    module: `${baseUrl}/esnet-matrix-panel/1.0.6/public/plugins/esnet-matrix-panel/module`,
  },
  {
    id: 'agenty-flowcharting-panel',
    name: 'FlowCharting',
    info: {
      description:
        'Flowcharting is a Grafana plugin. Use it to display complexe diagrams using the online graphing library draw.io like a vsio',
      logos: {
        small: `${cdnHost}/agenty-flowcharting-panel/0.9.1/public/plugins/agenty-flowcharting-panel/img/logo.svg`,
        large: `${cdnHost}/agenty-flowcharting-panel/0.9.1/public/plugins/agenty-flowcharting-panel/img/logo.svg`,
      },
      version: '0.9.1',
    },
    baseUrl: `${baseUrl}/agenty-flowcharting-panel/0.9.1/public/plugins/agenty-flowcharting-panel`,
    module: `${baseUrl}/agenty-flowcharting-panel/0.9.1/public/plugins/agenty-flowcharting-panel/module`,
  },
  {
    id: 'foursquare-studio-panel',
    name: 'Foursquare Studio Panel',
    info: {
      description: '',
      logos: {
        small: `${cdnHost}/foursquare-studio-panel/1.0.1/public/plugins/foursquare-studio-panel/img/logo.svg`,
        large: `${cdnHost}/foursquare-studio-panel/1.0.1/public/plugins/foursquare-studio-panel/img/logo.svg`,
      },
      version: '1.0.1',
    },
    baseUrl: `${baseUrl}/foursquare-studio-panel/1.0.1/public/plugins/foursquare-studio-panel`,
    module: `${baseUrl}/foursquare-studio-panel/1.0.1/public/plugins/foursquare-studio-panel/module`,
  },
  {
    id: 'marcusolsson-gantt-panel',
    name: 'Gantt',
    info: {
      description: 'Tasks and processes over time',
      logos: {
        small: `${cdnHost}/marcusolsson-gantt-panel/0.8.1/public/plugins/marcusolsson-gantt-panel/img/logo.svg`,
        large: `${cdnHost}/marcusolsson-gantt-panel/0.8.1/public/plugins/marcusolsson-gantt-panel/img/logo.svg`,
      },
      version: '0.8.1',
    },
    baseUrl: `${baseUrl}/marcusolsson-gantt-panel/0.8.1/public/plugins/marcusolsson-gantt-panel`,
    module: `${baseUrl}/marcusolsson-gantt-panel/0.8.1/public/plugins/marcusolsson-gantt-panel/module`,
  },
  {
    id: 'citilogics-geoloop-panel',
    name: 'GeoLoop',
    info: {
      description: 'Looping animated map for Grafana.',
      logos: {
        small: `${cdnHost}/citilogics-geoloop-panel/1.1.2/public/plugins/citilogics-geoloop-panel/img/logo.svg`,
        large: `${cdnHost}/citilogics-geoloop-panel/1.1.2/public/plugins/citilogics-geoloop-panel/img/logo.svg`,
      },
      version: '1.1.2',
    },
    baseUrl: `${baseUrl}/citilogics-geoloop-panel/1.1.2/public/plugins/citilogics-geoloop-panel`,
    module: `${baseUrl}/citilogics-geoloop-panel/1.1.2/public/plugins/citilogics-geoloop-panel/module`,
  },
  {
    id: 'grafana-guidedtour-panel',
    name: 'Guided Tour',
    info: {
      description: 'Guided tour for Grafana dashboards',
      logos: {
        small: `${cdnHost}/grafana-guidedtour-panel/0.2.0/public/plugins/grafana-guidedtour-panel/img/logo.svg`,
        large: `${cdnHost}/grafana-guidedtour-panel/0.2.0/public/plugins/grafana-guidedtour-panel/img/logo.svg`,
      },
      version: '0.2.0',
    },
    baseUrl: `${baseUrl}/grafana-guidedtour-panel/0.2.0/public/plugins/grafana-guidedtour-panel`,
    module: `${baseUrl}/grafana-guidedtour-panel/0.2.0/public/plugins/grafana-guidedtour-panel/module`,
  },
  {
    id: 'savantly-heatmap-panel',
    name: 'Heatmap',
    info: {
      description: 'Heatmap panel for grafana',
      logos: {
        small: `${cdnHost}/savantly-heatmap-panel/0.2.1/public/plugins/savantly-heatmap-panel/img/logo.svg`,
        large: `${cdnHost}/savantly-heatmap-panel/0.2.1/public/plugins/savantly-heatmap-panel/img/logo.svg`,
      },
      version: '0.2.1',
    },
    baseUrl: `${baseUrl}/savantly-heatmap-panel/0.2.1/public/plugins/savantly-heatmap-panel`,
    module: `${baseUrl}/savantly-heatmap-panel/0.2.1/public/plugins/savantly-heatmap-panel/module`,
  },
  {
    id: 'mtanda-heatmap-epoch-panel',
    name: 'HeatmapEpoch',
    info: {
      description: 'Heatmap Panel for Grafana',
      logos: {
        small: `${cdnHost}/mtanda-heatmap-epoch-panel/0.1.8/public/plugins/mtanda-heatmap-epoch-panel/img/logo.svg`,
        large: `${cdnHost}/mtanda-heatmap-epoch-panel/0.1.8/public/plugins/mtanda-heatmap-epoch-panel/img/logo.svg`,
      },
      version: '0.1.8',
    },
    baseUrl: `${baseUrl}/mtanda-heatmap-epoch-panel/0.1.8/public/plugins/mtanda-heatmap-epoch-panel`,
    module: `${baseUrl}/mtanda-heatmap-epoch-panel/0.1.8/public/plugins/mtanda-heatmap-epoch-panel/module`,
  },
  {
    id: 'marcusolsson-hexmap-panel',
    name: 'Hexmap',
    info: {
      description: 'Hexagonal tiling of data',
      logos: {
        small: `${cdnHost}/marcusolsson-hexmap-panel/0.3.3/public/plugins/marcusolsson-hexmap-panel/img/logo.svg`,
        large: `${cdnHost}/marcusolsson-hexmap-panel/0.3.3/public/plugins/marcusolsson-hexmap-panel/img/logo.svg`,
      },
      version: '0.3.3',
    },
    baseUrl: `${baseUrl}/marcusolsson-hexmap-panel/0.3.3/public/plugins/marcusolsson-hexmap-panel`,
    module: `${baseUrl}/marcusolsson-hexmap-panel/0.3.3/public/plugins/marcusolsson-hexmap-panel/module`,
  },
  {
    id: 'mtanda-histogram-panel',
    name: 'Histogram',
    info: {
      description: 'Histogram Panel for Grafana',
      logos: {
        small: `${cdnHost}/mtanda-histogram-panel/0.1.7/public/plugins/mtanda-histogram-panel/img/logo.svg`,
        large: `${cdnHost}/mtanda-histogram-panel/0.1.7/public/plugins/mtanda-histogram-panel/img/logo.svg`,
      },
      version: '0.1.7',
    },
    baseUrl: `${baseUrl}/mtanda-histogram-panel/0.1.7/public/plugins/mtanda-histogram-panel`,
    module: `${baseUrl}/mtanda-histogram-panel/0.1.7/public/plugins/mtanda-histogram-panel/module`,
  },
  {
    id: 'marcusolsson-hourly-heatmap-panel',
    name: 'Hourly heatmap',
    info: {
      description: 'Heatmap for the hours of the day',
      logos: {
        small: `${cdnHost}/marcusolsson-hourly-heatmap-panel/2.0.1/public/plugins/marcusolsson-hourly-heatmap-panel/img/logo.svg`,
        large: `${cdnHost}/marcusolsson-hourly-heatmap-panel/2.0.1/public/plugins/marcusolsson-hourly-heatmap-panel/img/logo.svg`,
      },
      version: '2.0.1',
    },
    baseUrl: `${baseUrl}/marcusolsson-hourly-heatmap-panel/2.0.1/public/plugins/marcusolsson-hourly-heatmap-panel`,
    module: `${baseUrl}/marcusolsson-hourly-heatmap-panel/2.0.1/public/plugins/marcusolsson-hourly-heatmap-panel/module`,
  },
  {
    id: 'aidanmountford-html-panel',
    name: 'HTML',
    info: {
      description: 'HTML panel for grafana',
      logos: {
        small: `${cdnHost}/aidanmountford-html-panel/0.0.2/public/plugins/aidanmountford-html-panel/img/logo.svg`,
        large: `${cdnHost}/aidanmountford-html-panel/0.0.2/public/plugins/aidanmountford-html-panel/img/logo.svg`,
      },
      version: '0.0.2',
    },
    baseUrl: `${baseUrl}/aidanmountford-html-panel/0.0.2/public/plugins/aidanmountford-html-panel`,
    module: `${baseUrl}/aidanmountford-html-panel/0.0.2/public/plugins/aidanmountford-html-panel/module`,
  },
  {
    id: 'gapit-htmlgraphics-panel',
    name: 'HTML graphics',
    info: {
      description: 'Grafana panel for displaying metric sensitive HTML and SVG graphics',
      logos: {
        small: `${cdnHost}/gapit-htmlgraphics-panel/2.1.1/public/plugins/gapit-htmlgraphics-panel/img/logo.svg`,
        large: `${cdnHost}/gapit-htmlgraphics-panel/2.1.1/public/plugins/gapit-htmlgraphics-panel/img/logo.svg`,
      },
      version: '2.1.1',
    },
    baseUrl: `${baseUrl}/gapit-htmlgraphics-panel/2.1.1/public/plugins/gapit-htmlgraphics-panel`,
    module: `${baseUrl}/gapit-htmlgraphics-panel/2.1.1/public/plugins/gapit-htmlgraphics-panel/module`,
  },
  {
    id: 'pierosavi-imageit-panel',
    name: 'ImageIt',
    info: {
      description: 'Add Measurements to a Picture in Grafana',
      logos: {
        small: `${cdnHost}/pierosavi-imageit-panel/1.0.7/public/plugins/pierosavi-imageit-panel/img/logo.svg`,
        large: `${cdnHost}/pierosavi-imageit-panel/1.0.7/public/plugins/pierosavi-imageit-panel/img/logo.svg`,
      },
      version: '1.0.7',
    },
    baseUrl: `${baseUrl}/pierosavi-imageit-panel/1.0.7/public/plugins/pierosavi-imageit-panel`,
    module: `${baseUrl}/pierosavi-imageit-panel/1.0.7/public/plugins/pierosavi-imageit-panel/module`,
  },
  {
    id: 'natel-influx-admin-panel',
    name: 'Influx Admin',
    info: {
      description: 'InfluxDB admin for grafana',
      logos: {
        small: `${cdnHost}/natel-influx-admin-panel/0.0.6/public/plugins/natel-influx-admin-panel/img/logo.svg`,
        large: `${cdnHost}/natel-influx-admin-panel/0.0.6/public/plugins/natel-influx-admin-panel/img/logo.svg`,
      },
      version: '0.0.6',
    },
    baseUrl: `${baseUrl}/natel-influx-admin-panel/0.0.6/public/plugins/natel-influx-admin-panel`,
    module: `${baseUrl}/natel-influx-admin-panel/0.0.6/public/plugins/natel-influx-admin-panel/module`,
  },
  {
    id: 'woutervh-mapbox-panel',
    name: 'mapbox-panel',
    info: {
      description: 'Grafana panel that displays spatial data on mapbox-gl.',
      logos: {
        small: `${cdnHost}/woutervh-mapbox-panel/1.0.0/public/plugins/woutervh-mapbox-panel/img/logo.svg`,
        large: `${cdnHost}/woutervh-mapbox-panel/1.0.0/public/plugins/woutervh-mapbox-panel/img/logo.svg`,
      },
      version: '1.0.0',
    },
    baseUrl: `${baseUrl}/woutervh-mapbox-panel/1.0.0/public/plugins/woutervh-mapbox-panel`,
    module: `${baseUrl}/woutervh-mapbox-panel/1.0.0/public/plugins/woutervh-mapbox-panel/module`,
  },
  {
    id: 'flaminggoat-maptrack3d-panel',
    name: 'MapTrack3D',
    info: {
      description: 'A plugin for Grafana that visualizes GPS points on a 3D globe',
      logos: {
        small: `${cdnHost}/flaminggoat-maptrack3d-panel/0.1.9/public/plugins/flaminggoat-maptrack3d-panel/img/logo.svg`,
        large: `${cdnHost}/flaminggoat-maptrack3d-panel/0.1.9/public/plugins/flaminggoat-maptrack3d-panel/img/logo.svg`,
      },
      version: '0.1.9',
    },
    baseUrl: `${baseUrl}/flaminggoat-maptrack3d-panel/0.1.9/public/plugins/flaminggoat-maptrack3d-panel`,
    module: `${baseUrl}/flaminggoat-maptrack3d-panel/0.1.9/public/plugins/flaminggoat-maptrack3d-panel/module`,
  },
  {
    id: 'thiagoarrais-matomotracking-panel',
    name: 'Matomo Tracker',
    info: {
      description: 'Panel for tracking via Matomo',
      logos: {
        small: `${cdnHost}/thiagoarrais-matomotracking-panel/0.2.3/public/plugins/thiagoarrais-matomotracking-panel/img/logo.svg`,
        large: `${cdnHost}/thiagoarrais-matomotracking-panel/0.2.3/public/plugins/thiagoarrais-matomotracking-panel/img/logo.svg`,
      },
      version: '0.2.3',
    },
    baseUrl: `${baseUrl}/thiagoarrais-matomotracking-panel/0.2.3/public/plugins/thiagoarrais-matomotracking-panel`,
    module: `${baseUrl}/thiagoarrais-matomotracking-panel/0.2.3/public/plugins/thiagoarrais-matomotracking-panel/module`,
  },
  {
    id: 'boazreicher-mosaicplot-panel',
    name: 'Mosaic',
    info: {
      description: 'Mosaic Plot Panel',
      logos: {
        small: `${cdnHost}/boazreicher-mosaicplot-panel/1.0.14/public/plugins/boazreicher-mosaicplot-panel/img/logo.svg`,
        large: `${cdnHost}/boazreicher-mosaicplot-panel/1.0.14/public/plugins/boazreicher-mosaicplot-panel/img/logo.svg`,
      },
      version: '1.0.14',
    },
    baseUrl: `${baseUrl}/boazreicher-mosaicplot-panel/1.0.14/public/plugins/boazreicher-mosaicplot-panel`,
    module: `${baseUrl}/boazreicher-mosaicplot-panel/1.0.14/public/plugins/boazreicher-mosaicplot-panel/module`,
  },
  {
    id: 'michaeldmoore-multistat-panel',
    name: 'Multistat',
    info: {
      description: 'Enhanced version of built-in SingleStat panel, for queries involving multi-valued recordsets',
      logos: {
        small: `${cdnHost}/michaeldmoore-multistat-panel/1.7.2/public/plugins/michaeldmoore-multistat-panel/img/logo.svg`,
        large: `${cdnHost}/michaeldmoore-multistat-panel/1.7.2/public/plugins/michaeldmoore-multistat-panel/img/logo.svg`,
      },
      version: '1.7.2',
    },
    baseUrl: `${baseUrl}/michaeldmoore-multistat-panel/1.7.2/public/plugins/michaeldmoore-multistat-panel`,
    module: `${baseUrl}/michaeldmoore-multistat-panel/1.7.2/public/plugins/michaeldmoore-multistat-panel/module`,
  },
  {
    id: 'knightss27-weathermap-panel',
    name: 'Network Weathermap',
    info: {
      description: 'A simple & sleek network weathermap.',
      logos: {
        small: `${cdnHost}/knightss27-weathermap-panel/0.3.3/public/plugins/knightss27-weathermap-panel/img/logo.svg`,
        large: `${cdnHost}/knightss27-weathermap-panel/0.3.3/public/plugins/knightss27-weathermap-panel/img/logo.svg`,
      },
      version: '0.3.3',
    },
    baseUrl: `${baseUrl}/knightss27-weathermap-panel/0.3.3/public/plugins/knightss27-weathermap-panel`,
    module: `${baseUrl}/knightss27-weathermap-panel/0.3.3/public/plugins/knightss27-weathermap-panel/module`,
  },
  {
    id: 'orchestracities-iconstat-panel',
    name: 'Orchestra Cities Icon Stat Panel',
    info: {
      description: '',
      logos: {
        small: `${cdnHost}/orchestracities-iconstat-panel/1.2.3/public/plugins/orchestracities-iconstat-panel/img/logo.svg`,
        large: `${cdnHost}/orchestracities-iconstat-panel/1.2.3/public/plugins/orchestracities-iconstat-panel/img/logo.svg`,
      },
      version: '1.2.3',
    },
    baseUrl: `${baseUrl}/orchestracities-iconstat-panel/1.2.3/public/plugins/orchestracities-iconstat-panel`,
    module: `${baseUrl}/orchestracities-iconstat-panel/1.2.3/public/plugins/orchestracities-iconstat-panel/module`,
  },
  {
    id: 'orchestracities-map-panel',
    name: 'Orchestra Cities Map',
    info: {
      description: 'Orchestra Cities Map',
      logos: {
        small: `${cdnHost}/orchestracities-map-panel/1.4.4/public/plugins/orchestracities-map-panel/img/logo.svg`,
        large: `${cdnHost}/orchestracities-map-panel/1.4.4/public/plugins/orchestracities-map-panel/img/logo.svg`,
      },
      version: '1.4.4',
    },
    baseUrl: `${baseUrl}/orchestracities-map-panel/1.4.4/public/plugins/orchestracities-map-panel`,
    module: `${baseUrl}/orchestracities-map-panel/1.4.4/public/plugins/orchestracities-map-panel/module`,
  },
  {
    id: 'timomyl-organisations-panel',
    name: 'Organisations',
    info: {
      description: 'Organisations Panel for Grafana',
      logos: {
        small: `${cdnHost}/timomyl-organisations-panel/1.4.0/public/plugins/timomyl-organisations-panel/img/logo.svg`,
        large: `${cdnHost}/timomyl-organisations-panel/1.4.0/public/plugins/timomyl-organisations-panel/img/logo.svg`,
      },
      version: '1.4.0',
    },
    baseUrl: `${baseUrl}/timomyl-organisations-panel/1.4.0/public/plugins/timomyl-organisations-panel`,
    module: `${baseUrl}/timomyl-organisations-panel/1.4.0/public/plugins/timomyl-organisations-panel/module`,
  },
  {
    id: 'parca-panel',
    name: 'Parca Flamegraph',
    info: {
      description: 'Parca panel plugin for Grafana',
      logos: {
        small: `${cdnHost}/parca-panel/0.0.3/public/plugins/parca-panel/img/logo.svg`,
        large: `${cdnHost}/parca-panel/0.0.3/public/plugins/parca-panel/img/logo.svg`,
      },
      version: '0.0.3',
    },
    baseUrl: `${baseUrl}/parca-panel/0.0.3/public/plugins/parca-panel`,
    module: `${baseUrl}/parca-panel/0.0.3/public/plugins/parca-panel/module`,
  },
  {
    id: 'isaozler-paretochart-panel',
    name: 'Pareto Chart',
    info: {
      description: 'Pareto Chart for Grafana',
      logos: {
        small: `${cdnHost}/isaozler-paretochart-panel/0.3.4/public/plugins/isaozler-paretochart-panel/img/logo.svg`,
        large: `${cdnHost}/isaozler-paretochart-panel/0.3.4/public/plugins/isaozler-paretochart-panel/img/logo.svg`,
      },
      version: '0.3.4',
    },
    baseUrl: `${baseUrl}/isaozler-paretochart-panel/0.3.4/public/plugins/isaozler-paretochart-panel`,
    module: `${baseUrl}/isaozler-paretochart-panel/0.3.4/public/plugins/isaozler-paretochart-panel/module`,
  },
  {
    id: 'zuburqan-parity-report-panel',
    name: 'Parity Report',
    info: {
      description: 'Parity report plugin to compare metrics',
      logos: {
        small: `${cdnHost}/zuburqan-parity-report-panel/1.2.2/public/plugins/zuburqan-parity-report-panel/img/logo.svg`,
        large: `${cdnHost}/zuburqan-parity-report-panel/1.2.2/public/plugins/zuburqan-parity-report-panel/img/logo.svg`,
      },
      version: '1.2.2',
    },
    baseUrl: `${baseUrl}/zuburqan-parity-report-panel/1.2.2/public/plugins/zuburqan-parity-report-panel`,
    module: `${baseUrl}/zuburqan-parity-report-panel/1.2.2/public/plugins/zuburqan-parity-report-panel/module`,
  },
  {
    id: 'jeanbaptistewatenberg-percent-panel',
    name: 'Percent+',
    info: {
      description: 'Grafana percent+ stat panel. Simply computes and display percent given two metrics.',
      logos: {
        small: `${cdnHost}/jeanbaptistewatenberg-percent-panel/1.0.6/public/plugins/jeanbaptistewatenberg-percent-panel/img/logo.svg`,
        large: `${cdnHost}/jeanbaptistewatenberg-percent-panel/1.0.6/public/plugins/jeanbaptistewatenberg-percent-panel/img/logo.svg`,
      },
      version: '1.0.6',
    },
    baseUrl: `${baseUrl}/jeanbaptistewatenberg-percent-panel/1.0.6/public/plugins/jeanbaptistewatenberg-percent-panel`,
    module: `${baseUrl}/jeanbaptistewatenberg-percent-panel/1.0.6/public/plugins/jeanbaptistewatenberg-percent-panel/module`,
  },
  {
    id: 'nikosc-percenttrend-panel',
    name: 'Percentage Trend',
    info: {
      description: 'Percent change with trend display',
      logos: {
        small: `${cdnHost}/nikosc-percenttrend-panel/1.0.7/public/plugins/nikosc-percenttrend-panel/img/logo.svg`,
        large: `${cdnHost}/nikosc-percenttrend-panel/1.0.7/public/plugins/nikosc-percenttrend-panel/img/logo.svg`,
      },
      version: '1.0.7',
    },
    baseUrl: `${baseUrl}/nikosc-percenttrend-panel/1.0.7/public/plugins/nikosc-percenttrend-panel`,
    module: `${baseUrl}/nikosc-percenttrend-panel/1.0.7/public/plugins/nikosc-percenttrend-panel/module`,
  },
  {
    id: 'sskgo-perfcurve-panel',
    name: 'PerfCurve',
    info: {
      description: 'Plot rotating machine operation point on a performance curve.',
      logos: {
        small: `${cdnHost}/sskgo-perfcurve-panel/1.5.0/public/plugins/sskgo-perfcurve-panel/img/logo.svg`,
        large: `${cdnHost}/sskgo-perfcurve-panel/1.5.0/public/plugins/sskgo-perfcurve-panel/img/logo.svg`,
      },
      version: '1.5.0',
    },
    baseUrl: `${baseUrl}/sskgo-perfcurve-panel/1.5.0/public/plugins/sskgo-perfcurve-panel`,
    module: `${baseUrl}/sskgo-perfcurve-panel/1.5.0/public/plugins/sskgo-perfcurve-panel/module`,
  },
  {
    id: 'philipsgis-phlowchart-panel',
    name: 'Phlowchart',
    info: {
      description: 'A Grafana panel plugin to render interactive flowchart visualization of directed graph data.',
      logos: {
        small: `${cdnHost}/philipsgis-phlowchart-panel/0.1.0/public/plugins/philipsgis-phlowchart-panel/img/logo.svg`,
        large: `${cdnHost}/philipsgis-phlowchart-panel/0.1.0/public/plugins/philipsgis-phlowchart-panel/img/logo.svg`,
      },
      version: '0.1.0',
    },
    baseUrl: `${baseUrl}/philipsgis-phlowchart-panel/0.1.0/public/plugins/philipsgis-phlowchart-panel`,
    module: `${baseUrl}/philipsgis-phlowchart-panel/0.1.0/public/plugins/philipsgis-phlowchart-panel/module`,
  },
  {
    id: 'bessler-pictureit-panel',
    name: 'PictureIt',
    info: {
      description: 'Add Measurements to a Picture in Grafana',
      logos: {
        small: `${cdnHost}/bessler-pictureit-panel/1.0.1/public/plugins/bessler-pictureit-panel/img/logo.svg`,
        large: `${cdnHost}/bessler-pictureit-panel/1.0.1/public/plugins/bessler-pictureit-panel/img/logo.svg`,
      },
      version: '1.0.1',
    },
    baseUrl: `${baseUrl}/bessler-pictureit-panel/1.0.1/public/plugins/bessler-pictureit-panel`,
    module: `${baseUrl}/bessler-pictureit-panel/1.0.1/public/plugins/bessler-pictureit-panel/module`,
  },
  {
    id: 'natel-plotly-panel',
    name: 'Plotly',
    info: {
      description: 'Scatter plots and more',
      logos: {
        small: `${cdnHost}/natel-plotly-panel/0.0.7/public/plugins/natel-plotly-panel/img/logo.svg`,
        large: `${cdnHost}/natel-plotly-panel/0.0.7/public/plugins/natel-plotly-panel/img/logo.svg`,
      },
      version: '0.0.7',
    },
    baseUrl: `${baseUrl}/natel-plotly-panel/0.0.7/public/plugins/natel-plotly-panel`,
    module: `${baseUrl}/natel-plotly-panel/0.0.7/public/plugins/natel-plotly-panel/module`,
  },
  {
    id: 'nline-plotlyjs-panel',
    name: 'Plotly',
    info: {
      description: 'Render charts with Plotly.js',
      logos: {
        small: `${cdnHost}/nline-plotlyjs-panel/1.1.0/public/plugins/nline-plotlyjs-panel/img/logo.svg`,
        large: `${cdnHost}/nline-plotlyjs-panel/1.1.0/public/plugins/nline-plotlyjs-panel/img/logo.svg`,
      },
      version: '1.1.0',
    },
    baseUrl: `${baseUrl}/nline-plotlyjs-panel/1.1.0/public/plugins/nline-plotlyjs-panel`,
    module: `${baseUrl}/nline-plotlyjs-panel/1.1.0/public/plugins/nline-plotlyjs-panel/module`,
  },
  {
    id: 'ae3e-plotly-panel',
    name: 'Plotly panel',
    info: {
      description: 'Render chart from any datasource with Plotly javascript library',
      logos: {
        small: `${cdnHost}/ae3e-plotly-panel/0.5.0/public/plugins/ae3e-plotly-panel/img/logo.svg`,
        large: `${cdnHost}/ae3e-plotly-panel/0.5.0/public/plugins/ae3e-plotly-panel/img/logo.svg`,
      },
      version: '0.5.0',
    },
    baseUrl: `${baseUrl}/ae3e-plotly-panel/0.5.0/public/plugins/ae3e-plotly-panel`,
    module: `${baseUrl}/ae3e-plotly-panel/0.5.0/public/plugins/ae3e-plotly-panel/module`,
  },
  {
    id: 'grafana-polystat-panel',
    name: 'Polystat',
    info: {
      description: 'Polystat panel for Grafana',
      logos: {
        small: `${cdnHost}/grafana-polystat-panel/2.0.4/public/plugins/grafana-polystat-panel/img/logo.svg`,
        large: `${cdnHost}/grafana-polystat-panel/2.0.4/public/plugins/grafana-polystat-panel/img/logo.svg`,
      },
      version: '2.0.4',
    },
    baseUrl: `${baseUrl}/grafana-polystat-panel/2.0.4/public/plugins/grafana-polystat-panel`,
    module: `${baseUrl}/grafana-polystat-panel/2.0.4/public/plugins/grafana-polystat-panel/module`,
  },
  {
    id: 'corpglory-progresslist-panel',
    name: 'Progress List',
    info: {
      description: 'A panel showing list of progress-like items in one board',
      logos: {
        small: `${cdnHost}/corpglory-progresslist-panel/1.0.6/public/plugins/corpglory-progresslist-panel/img/logo.svg`,
        large: `${cdnHost}/corpglory-progresslist-panel/1.0.6/public/plugins/corpglory-progresslist-panel/img/logo.svg`,
      },
      version: '1.0.6',
    },
    baseUrl: `${baseUrl}/corpglory-progresslist-panel/1.0.6/public/plugins/corpglory-progresslist-panel`,
    module: `${baseUrl}/corpglory-progresslist-panel/1.0.6/public/plugins/corpglory-progresslist-panel/module`,
  },
  {
    id: 'ventura-psychrometric-panel',
    name: 'Psychrometric Chart',
    info: {
      description: 'View air conditions on a psychrometric chart.',
      logos: {
        small: `${cdnHost}/ventura-psychrometric-panel/2.0.0/public/plugins/ventura-psychrometric-panel/img/logo.svg`,
        large: `${cdnHost}/ventura-psychrometric-panel/2.0.0/public/plugins/ventura-psychrometric-panel/img/logo.svg`,
      },
      version: '2.0.0',
    },
    baseUrl: `${baseUrl}/ventura-psychrometric-panel/2.0.0/public/plugins/ventura-psychrometric-panel`,
    module: `${baseUrl}/ventura-psychrometric-panel/2.0.0/public/plugins/ventura-psychrometric-panel/module`,
  },
  {
    id: 'pyroscope-panel',
    name: 'Pyroscope Flamegraph',
    info: {
      description: 'Pyroscope plugin for grafana',
      logos: {
        small: `${cdnHost}/pyroscope-panel/1.4.1/public/plugins/pyroscope-panel/img/logo.svg`,
        large: `${cdnHost}/pyroscope-panel/1.4.1/public/plugins/pyroscope-panel/img/logo.svg`,
      },
      version: '1.4.1',
    },
    baseUrl: `${baseUrl}/pyroscope-panel/1.4.1/public/plugins/pyroscope-panel`,
    module: `${baseUrl}/pyroscope-panel/1.4.1/public/plugins/pyroscope-panel/module`,
  },
  {
    id: 'snuids-radar-panel',
    name: 'Radar Graph',
    info: {
      description: 'Radar Graph for grafana',
      logos: {
        small: `${cdnHost}/snuids-radar-panel/1.5.1/public/plugins/snuids-radar-panel/img/logo.svg`,
        large: `${cdnHost}/snuids-radar-panel/1.5.1/public/plugins/snuids-radar-panel/img/logo.svg`,
      },
      version: '1.5.1',
    },
    baseUrl: `${baseUrl}/snuids-radar-panel/1.5.1/public/plugins/snuids-radar-panel`,
    module: `${baseUrl}/snuids-radar-panel/1.5.1/public/plugins/snuids-radar-panel/module`,
  },
  {
    id: 'netsage-sankey-panel',
    name: 'Sankey Panel',
    info: {
      description: 'Sankey Panel Plugin for Grafana',
      logos: {
        small: `${cdnHost}/netsage-sankey-panel/1.0.6/public/plugins/netsage-sankey-panel/img/logo.svg`,
        large: `${cdnHost}/netsage-sankey-panel/1.0.6/public/plugins/netsage-sankey-panel/img/logo.svg`,
      },
      version: '1.0.6',
    },
    baseUrl: `${baseUrl}/netsage-sankey-panel/1.0.6/public/plugins/netsage-sankey-panel`,
    module: `${baseUrl}/netsage-sankey-panel/1.0.6/public/plugins/netsage-sankey-panel/module`,
  },
  {
    id: 'scadavis-synoptic-panel',
    name: 'SCADAvis Synoptic Panel',
    info: {
      description: 'SCADA-like synoptic panel for grafana',
      logos: {
        small: `${cdnHost}/scadavis-synoptic-panel/1.0.5/public/plugins/scadavis-synoptic-panel/img/logo.svg`,
        large: `${cdnHost}/scadavis-synoptic-panel/1.0.5/public/plugins/scadavis-synoptic-panel/img/logo.svg`,
      },
      version: '1.0.5',
    },
    baseUrl: `${baseUrl}/scadavis-synoptic-panel/1.0.5/public/plugins/scadavis-synoptic-panel`,
    module: `${baseUrl}/scadavis-synoptic-panel/1.0.5/public/plugins/scadavis-synoptic-panel/module`,
  },
  {
    id: 'michaeldmoore-scatter-panel',
    name: 'Scatter',
    info: {
      description: 'A really easy-to-use scatter-plot plugin panel for table formatted Grafana data',
      logos: {
        small: `${cdnHost}/michaeldmoore-scatter-panel/1.2.0/public/plugins/michaeldmoore-scatter-panel/img/logo.svg`,
        large: `${cdnHost}/michaeldmoore-scatter-panel/1.2.0/public/plugins/michaeldmoore-scatter-panel/img/logo.svg`,
      },
      version: '1.2.0',
    },
    baseUrl: `${baseUrl}/michaeldmoore-scatter-panel/1.2.0/public/plugins/michaeldmoore-scatter-panel`,
    module: `${baseUrl}/michaeldmoore-scatter-panel/1.2.0/public/plugins/michaeldmoore-scatter-panel/module`,
  },
  {
    id: 'mxswat-separator-panel',
    name: 'Separator',
    info: {
      description: 'A simple separator panel',
      logos: {
        small: `${cdnHost}/mxswat-separator-panel/1.0.1/public/plugins/mxswat-separator-panel/img/logo.svg`,
        large: `${cdnHost}/mxswat-separator-panel/1.0.1/public/plugins/mxswat-separator-panel/img/logo.svg`,
      },
      version: '1.0.1',
    },
    baseUrl: `${baseUrl}/mxswat-separator-panel/1.0.1/public/plugins/mxswat-separator-panel`,
    module: `${baseUrl}/mxswat-separator-panel/1.0.1/public/plugins/mxswat-separator-panel/module`,
  },
  {
    id: 'novatec-sdg-panel',
    name: 'Service Dependency Graph',
    info: {
      description:
        'Service Dependency Graph panel for Grafana. Shows metric-based, dynamic dependency graph between services, indicates responsetime, load and error rate statistic for individual services and communication edges. Shows communication to external services, such as Web calls, database calls, message queues, LDAP calls, etc. Provides a details dialog for each selected service that shows statistics about incoming and outgoing traffic.',
      logos: {
        small: `${cdnHost}/novatec-sdg-panel/4.0.3/public/plugins/novatec-sdg-panel/img/logo.svg`,
        large: `${cdnHost}/novatec-sdg-panel/4.0.3/public/plugins/novatec-sdg-panel/img/logo.svg`,
      },
      version: '4.0.3',
    },
    baseUrl: `${baseUrl}/novatec-sdg-panel/4.0.3/public/plugins/novatec-sdg-panel`,
    module: `${baseUrl}/novatec-sdg-panel/4.0.3/public/plugins/novatec-sdg-panel/module`,
  },
  {
    id: 'isaozler-shiftselector-panel',
    name: 'Shift Selector',
    info: {
      description:
        'The shift selector allows you to adjust the time range of your grafana dashboard to one specific shift or a range of shifts.',
      logos: {
        small: `${cdnHost}/isaozler-shiftselector-panel/0.0.3/public/plugins/isaozler-shiftselector-panel/img/logo.svg`,
        large: `${cdnHost}/isaozler-shiftselector-panel/0.0.3/public/plugins/isaozler-shiftselector-panel/img/logo.svg`,
      },
      version: '0.0.3',
    },
    baseUrl: `${baseUrl}/isaozler-shiftselector-panel/0.0.3/public/plugins/isaozler-shiftselector-panel`,
    module: `${baseUrl}/isaozler-shiftselector-panel/0.0.3/public/plugins/isaozler-shiftselector-panel/module`,
  },
  {
    id: 'boazreicher-sierraplot-panel',
    name: 'Sierra Plot',
    info: {
      description: 'Sierra Plot Panel',
      logos: {
        small: `${cdnHost}/boazreicher-sierraplot-panel/1.0.14/public/plugins/boazreicher-sierraplot-panel/img/logo.svg`,
        large: `${cdnHost}/boazreicher-sierraplot-panel/1.0.14/public/plugins/boazreicher-sierraplot-panel/img/logo.svg`,
      },
      version: '1.0.14',
    },
    baseUrl: `${baseUrl}/boazreicher-sierraplot-panel/1.0.14/public/plugins/boazreicher-sierraplot-panel`,
    module: `${baseUrl}/boazreicher-sierraplot-panel/1.0.14/public/plugins/boazreicher-sierraplot-panel/module`,
  },
  {
    id: 'grafana-singlestat-panel',
    name: 'Singlestat',
    info: {
      description: 'Singlestat Panel for Grafana',
      logos: {
        small: `${cdnHost}/grafana-singlestat-panel/2.0.0/public/plugins/grafana-singlestat-panel/img/logo.svg`,
        large: `${cdnHost}/grafana-singlestat-panel/2.0.0/public/plugins/grafana-singlestat-panel/img/logo.svg`,
      },
      version: '2.0.0',
    },
    baseUrl: `${baseUrl}/grafana-singlestat-panel/2.0.0/public/plugins/grafana-singlestat-panel`,
    module: `${baseUrl}/grafana-singlestat-panel/2.0.0/public/plugins/grafana-singlestat-panel/module`,
  },
  {
    id: 'blackmirror1-singlestat-math-panel',
    name: 'Singlestat Math',
    info: {
      description: 'Single Stat panel with math.',
      logos: {
        small: `${cdnHost}/blackmirror1-singlestat-math-panel/1.1.8/public/plugins/blackmirror1-singlestat-math-panel/img/logo.svg`,
        large: `${cdnHost}/blackmirror1-singlestat-math-panel/1.1.8/public/plugins/blackmirror1-singlestat-math-panel/img/logo.svg`,
      },
      version: '1.1.8',
    },
    baseUrl: `${baseUrl}/blackmirror1-singlestat-math-panel/1.1.8/public/plugins/blackmirror1-singlestat-math-panel`,
    module: `${baseUrl}/blackmirror1-singlestat-math-panel/1.1.8/public/plugins/blackmirror1-singlestat-math-panel/module`,
  },
  {
    id: 'netsage-slopegraph-panel',
    name: 'Slope Graph Panel',
    info: {
      description: 'Slope Graph Panel',
      logos: {
        small: `${cdnHost}/netsage-slopegraph-panel/1.0.6/public/plugins/netsage-slopegraph-panel/img/logo.svg`,
        large: `${cdnHost}/netsage-slopegraph-panel/1.0.6/public/plugins/netsage-slopegraph-panel/img/logo.svg`,
      },
      version: '1.0.6',
    },
    baseUrl: `${baseUrl}/netsage-slopegraph-panel/1.0.6/public/plugins/netsage-slopegraph-panel`,
    module: `${baseUrl}/netsage-slopegraph-panel/1.0.6/public/plugins/netsage-slopegraph-panel/module`,
  },
  {
    id: 'blackmirror1-statusbygroup-panel',
    name: 'Status By Group Panel',
    info: {
      description: 'Status By Group Panel for Grafana',
      logos: {
        small: `${cdnHost}/blackmirror1-statusbygroup-panel/1.1.2/public/plugins/blackmirror1-statusbygroup-panel/img/logo.svg`,
        large: `${cdnHost}/blackmirror1-statusbygroup-panel/1.1.2/public/plugins/blackmirror1-statusbygroup-panel/img/logo.svg`,
      },
      version: '1.1.2',
    },
    baseUrl: `${baseUrl}/blackmirror1-statusbygroup-panel/1.1.2/public/plugins/blackmirror1-statusbygroup-panel`,
    module: `${baseUrl}/blackmirror1-statusbygroup-panel/1.1.2/public/plugins/blackmirror1-statusbygroup-panel/module`,
  },
  {
    id: 'vonage-status-panel',
    name: 'Status Panel',
    info: {
      description: 'Status Panel for Grafana',
      logos: {
        small: `${cdnHost}/vonage-status-panel/1.0.11/public/plugins/vonage-status-panel/img/logo.svg`,
        large: `${cdnHost}/vonage-status-panel/1.0.11/public/plugins/vonage-status-panel/img/logo.svg`,
      },
      version: '1.0.11',
    },
    baseUrl: `${baseUrl}/vonage-status-panel/1.0.11/public/plugins/vonage-status-panel`,
    module: `${baseUrl}/vonage-status-panel/1.0.11/public/plugins/vonage-status-panel/module`,
  },
  {
    id: 'flant-statusmap-panel',
    name: 'Statusmap',
    info: {
      description: 'Statusmap panel for grafana',
      logos: {
        small: `${cdnHost}/flant-statusmap-panel/0.5.1/public/plugins/flant-statusmap-panel/img/logo.svg`,
        large: `${cdnHost}/flant-statusmap-panel/0.5.1/public/plugins/flant-statusmap-panel/img/logo.svg`,
      },
      version: '0.5.1',
    },
    baseUrl: `${baseUrl}/flant-statusmap-panel/0.5.1/public/plugins/flant-statusmap-panel`,
    module: `${baseUrl}/flant-statusmap-panel/0.5.1/public/plugins/flant-statusmap-panel/module`,
  },
  {
    id: 'marcuscalidus-svg-panel',
    name: 'SVG',
    info: {
      description: 'SVG panel for grafana',
      logos: {
        small: `${cdnHost}/marcuscalidus-svg-panel/0.3.4/public/plugins/marcuscalidus-svg-panel/img/logo.svg`,
        large: `${cdnHost}/marcuscalidus-svg-panel/0.3.4/public/plugins/marcuscalidus-svg-panel/img/logo.svg`,
      },
      version: '0.3.4',
    },
    baseUrl: `${baseUrl}/marcuscalidus-svg-panel/0.3.4/public/plugins/marcuscalidus-svg-panel`,
    module: `${baseUrl}/marcuscalidus-svg-panel/0.3.4/public/plugins/marcuscalidus-svg-panel/module`,
  },
  {
    id: 'williamvenner-timepickerbuttons-panel',
    name: 'Timepicker Buttons Panel',
    info: {
      description: 'Datasource-configured buttons panel plugin which set the time range of your Grafana dashboard',
      logos: {
        small: `${cdnHost}/williamvenner-timepickerbuttons-panel/4.1.1/public/plugins/williamvenner-timepickerbuttons-panel/img/logo.svg`,
        large: `${cdnHost}/williamvenner-timepickerbuttons-panel/4.1.1/public/plugins/williamvenner-timepickerbuttons-panel/img/logo.svg`,
      },
      version: '4.1.1',
    },
    baseUrl: `${baseUrl}/williamvenner-timepickerbuttons-panel/4.1.1/public/plugins/williamvenner-timepickerbuttons-panel`,
    module: `${baseUrl}/williamvenner-timepickerbuttons-panel/4.1.1/public/plugins/williamvenner-timepickerbuttons-panel/module`,
  },
  {
    id: 'gretamosa-topology-panel',
    name: 'Topology Panel',
    info: {
      description: 'Sigma.js graph panel for grafana',
      logos: {
        small: `${cdnHost}/gretamosa-topology-panel/1.0.1/public/plugins/gretamosa-topology-panel/img/logo.svg`,
        large: `${cdnHost}/gretamosa-topology-panel/1.0.1/public/plugins/gretamosa-topology-panel/img/logo.svg`,
      },
      version: '1.0.1',
    },
    baseUrl: `${baseUrl}/gretamosa-topology-panel/1.0.1/public/plugins/gretamosa-topology-panel`,
    module: `${baseUrl}/gretamosa-topology-panel/1.0.1/public/plugins/gretamosa-topology-panel/module`,
  },
  {
    id: 'gowee-traceroutemap-panel',
    name: 'Traceroute Map Panel',
    info: {
      description: 'A Grafana panel that visualize traceroute hops in a map',
      logos: {
        small: `${cdnHost}/gowee-traceroutemap-panel/0.3.0/public/plugins/gowee-traceroutemap-panel/img/logo.svg`,
        large: `${cdnHost}/gowee-traceroutemap-panel/0.3.0/public/plugins/gowee-traceroutemap-panel/img/logo.svg`,
      },
      version: '0.3.0',
    },
    baseUrl: `${baseUrl}/gowee-traceroutemap-panel/0.3.0/public/plugins/gowee-traceroutemap-panel`,
    module: `${baseUrl}/gowee-traceroutemap-panel/0.3.0/public/plugins/gowee-traceroutemap-panel/module`,
  },
  {
    id: 'alexandra-trackmap-panel',
    name: 'Track Map',
    info: {
      description:
        'Map plugin to visualize timeseries data from geo:json or NGSIv2 sources as either a Ant-path, Hexbin, or Heatmap.',
      logos: {
        small: `${cdnHost}/alexandra-trackmap-panel/1.2.6/public/plugins/alexandra-trackmap-panel/img/logo.svg`,
        large: `${cdnHost}/alexandra-trackmap-panel/1.2.6/public/plugins/alexandra-trackmap-panel/img/logo.svg`,
      },
      version: '1.2.6',
    },
    baseUrl: `${baseUrl}/alexandra-trackmap-panel/1.2.6/public/plugins/alexandra-trackmap-panel`,
    module: `${baseUrl}/alexandra-trackmap-panel/1.2.6/public/plugins/alexandra-trackmap-panel/module`,
  },
  {
    id: 'pr0ps-trackmap-panel',
    name: 'TrackMap',
    info: {
      description: 'A plugin for Grafana that visualizes GPS points as a line on an interactive map.',
      logos: {
        small: `${cdnHost}/pr0ps-trackmap-panel/2.1.2/public/plugins/pr0ps-trackmap-panel/img/logo.svg`,
        large: `${cdnHost}/pr0ps-trackmap-panel/2.1.2/public/plugins/pr0ps-trackmap-panel/img/logo.svg`,
      },
      version: '2.1.2',
    },
    baseUrl: `${baseUrl}/pr0ps-trackmap-panel/2.1.2/public/plugins/pr0ps-trackmap-panel`,
    module: `${baseUrl}/pr0ps-trackmap-panel/2.1.2/public/plugins/pr0ps-trackmap-panel/module`,
  },
  {
    id: 'snuids-trafficlights-panel',
    name: 'Traffic Lights',
    info: {
      description: 'Traffic lights for grafana',
      logos: {
        small: `${cdnHost}/snuids-trafficlights-panel/1.5.1/public/plugins/snuids-trafficlights-panel/img/logo.svg`,
        large: `${cdnHost}/snuids-trafficlights-panel/1.5.1/public/plugins/snuids-trafficlights-panel/img/logo.svg`,
      },
      version: '1.5.1',
    },
    baseUrl: `${baseUrl}/snuids-trafficlights-panel/1.5.1/public/plugins/snuids-trafficlights-panel`,
    module: `${baseUrl}/snuids-trafficlights-panel/1.5.1/public/plugins/snuids-trafficlights-panel/module`,
  },
  {
    id: 'smartmakers-trafficlight-panel',
    name: 'TrafficLight',
    info: {
      description: 'Add colour indicator for measurements to a picture in Grafana',
      logos: {
        small: `${cdnHost}/smartmakers-trafficlight-panel/1.0.1/public/plugins/smartmakers-trafficlight-panel/img/logo.svg`,
        large: `${cdnHost}/smartmakers-trafficlight-panel/1.0.1/public/plugins/smartmakers-trafficlight-panel/img/logo.svg`,
      },
      version: '1.0.1',
    },
    baseUrl: `${baseUrl}/smartmakers-trafficlight-panel/1.0.1/public/plugins/smartmakers-trafficlight-panel`,
    module: `${baseUrl}/smartmakers-trafficlight-panel/1.0.1/public/plugins/smartmakers-trafficlight-panel/module`,
  },
  {
    id: 'pgillich-tree-panel',
    name: 'Tree View',
    info: {
      description:
        'Tree View for JSON API datasource. It can show JSON REST API responses, for example: Kubernetes API',
      logos: {
        small: `${cdnHost}/pgillich-tree-panel/0.1.9/public/plugins/pgillich-tree-panel/img/logo.svg`,
        large: `${cdnHost}/pgillich-tree-panel/0.1.9/public/plugins/pgillich-tree-panel/img/logo.svg`,
      },
      version: '0.1.9',
    },
    baseUrl: `${baseUrl}/pgillich-tree-panel/0.1.9/public/plugins/pgillich-tree-panel`,
    module: `${baseUrl}/pgillich-tree-panel/0.1.9/public/plugins/pgillich-tree-panel/module`,
  },
  {
    id: 'marcusolsson-treemap-panel',
    name: 'Treemap',
    info: {
      description: 'Area-based visualization of hierarchical data',
      logos: {
        small: `${cdnHost}/marcusolsson-treemap-panel/2.0.0/public/plugins/marcusolsson-treemap-panel/img/logo.svg`,
        large: `${cdnHost}/marcusolsson-treemap-panel/2.0.0/public/plugins/marcusolsson-treemap-panel/img/logo.svg`,
      },
      version: '2.0.0',
    },
    baseUrl: `${baseUrl}/marcusolsson-treemap-panel/2.0.0/public/plugins/marcusolsson-treemap-panel`,
    module: `${baseUrl}/marcusolsson-treemap-panel/2.0.0/public/plugins/marcusolsson-treemap-panel/module`,
  },
  {
    id: 'factry-untimely-panel',
    name: 'Untimely',
    info: {
      description: 'Grafana panel for displaying time series data as function of distance',
      logos: {
        small: `${cdnHost}/factry-untimely-panel/0.3.0/public/plugins/factry-untimely-panel/img/logo.svg`,
        large: `${cdnHost}/factry-untimely-panel/0.3.0/public/plugins/factry-untimely-panel/img/logo.svg`,
      },
      version: '0.3.0',
    },
    baseUrl: `${baseUrl}/factry-untimely-panel/0.3.0/public/plugins/factry-untimely-panel`,
    module: `${baseUrl}/factry-untimely-panel/0.3.0/public/plugins/factry-untimely-panel/module`,
  },
  {
    id: 'innius-video-panel',
    name: 'Video',
    info: {
      description: 'Display video from a URL, YouTube ID, or an iFrame.',
      logos: {
        small: `${cdnHost}/innius-video-panel/1.0.5/public/plugins/innius-video-panel/img/logo.svg`,
        large: `${cdnHost}/innius-video-panel/1.0.5/public/plugins/innius-video-panel/img/logo.svg`,
      },
      version: '1.0.5',
    },
    baseUrl: `${baseUrl}/innius-video-panel/1.0.5/public/plugins/innius-video-panel`,
    module: `${baseUrl}/innius-video-panel/1.0.5/public/plugins/innius-video-panel/module`,
  },
  {
    id: 'auxmoney-waterfall-panel',
    name: 'Waterfall Panel',
    info: {
      description: 'A waterfall panel for a single time-series',
      logos: {
        small: `${cdnHost}/auxmoney-waterfall-panel/1.0.6/public/plugins/auxmoney-waterfall-panel/img/logo.svg`,
        large: `${cdnHost}/auxmoney-waterfall-panel/1.0.6/public/plugins/auxmoney-waterfall-panel/img/logo.svg`,
      },
      version: '1.0.6',
    },
    baseUrl: `${baseUrl}/auxmoney-waterfall-panel/1.0.6/public/plugins/auxmoney-waterfall-panel`,
    module: `${baseUrl}/auxmoney-waterfall-panel/1.0.6/public/plugins/auxmoney-waterfall-panel/module`,
  },
  {
    id: 'lework-lenav-panel',
    name: 'Website Navigation',
    info: {
      description: 'A panel to display website navigation.',
      logos: {
        small: `${cdnHost}/lework-lenav-panel/1.0.0/public/plugins/lework-lenav-panel/img/logo.svg`,
        large: `${cdnHost}/lework-lenav-panel/1.0.0/public/plugins/lework-lenav-panel/img/logo.svg`,
      },
      version: '1.0.0',
    },
    baseUrl: `${baseUrl}/lework-lenav-panel/1.0.0/public/plugins/lework-lenav-panel`,
    module: `${baseUrl}/lework-lenav-panel/1.0.0/public/plugins/lework-lenav-panel/module`,
  },
  {
    id: 'fatcloud-windrose-panel',
    name: 'WindRose',
    info: {
      description: 'Make windrose plots',
      logos: {
        small: `${cdnHost}/fatcloud-windrose-panel/0.7.1/public/plugins/fatcloud-windrose-panel/img/logo.svg`,
        large: `${cdnHost}/fatcloud-windrose-panel/0.7.1/public/plugins/fatcloud-windrose-panel/img/logo.svg`,
      },
      version: '0.7.1',
    },
    baseUrl: `${baseUrl}/fatcloud-windrose-panel/0.7.1/public/plugins/fatcloud-windrose-panel`,
    module: `${baseUrl}/fatcloud-windrose-panel/0.7.1/public/plugins/fatcloud-windrose-panel/module`,
  },
  {
    id: 'magnesium-wordcloud-panel',
    name: 'Word cloud',
    info: {
      description: 'WordCloud / TagCloud Panel',
      logos: {
        small: `${cdnHost}/magnesium-wordcloud-panel/1.2.4/public/plugins/magnesium-wordcloud-panel/img/logo.svg`,
        large: `${cdnHost}/magnesium-wordcloud-panel/1.2.4/public/plugins/magnesium-wordcloud-panel/img/logo.svg`,
      },
      version: '1.2.4',
    },
    baseUrl: `${baseUrl}/magnesium-wordcloud-panel/1.2.4/public/plugins/magnesium-wordcloud-panel`,
    module: `${baseUrl}/magnesium-wordcloud-panel/1.2.4/public/plugins/magnesium-wordcloud-panel/module`,
  },
];

export const remotePanels = dummyData.reduce((acc, item) => {
  // @ts-ignore YOLO!!!!!!
  acc[item.id] = {
    ...dummyPanel,
    ...item,
    info: {
      ...dummyPanel.info,
      ...item.info,
    },
  };
  return acc;
}, {});
