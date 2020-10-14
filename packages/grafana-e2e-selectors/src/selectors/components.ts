import { Pages } from './pages';

export const Components = {
  DataSource: {
    TestData: {
      QueryTab: {
        scenarioSelect: 'Test Data Query scenario select',
        max: 'TestData max',
        min: 'TestData min',
        noise: 'TestData noise',
        seriesCount: 'TestData series count',
        spread: 'TestData spread',
        startValue: 'TestData start value',
      },
    },
  },
  Panels: {
    Panel: {
      title: (title: string) => `Panel header title item ${title}`,
      headerItems: (item: string) => `Panel header item ${item}`,
      containerByTitle: (title: string) => `Panel container title ${title}`,
    },
    Visualization: {
      Graph: {
        VisualizationTab: {
          legendSection: 'Legend section',
        },
        Legend: {
          legendItemAlias: (name: string) => `gpl alias ${name}`,
          showLegendSwitch: 'gpl show legend',
        },
        xAxis: {
          labels: () => 'div.flot-x-axis > div.flot-tick-label',
        },
      },
      BarGauge: {
        value: 'Bar gauge value',
      },
    },
  },
  Drawer: {
    General: {
      title: (title: string) => `Drawer title ${title}`,
      expand: 'Drawer expand',
      contract: 'Drawer contract',
      close: 'Drawer close',
      rcContentWrapper: () => '.drawer-content-wrapper',
    },
  },
  PanelEditor: {
    General: {
      content: 'Panel editor content',
    },
    OptionsPane: {
      content: 'Panel editor option pane content',
      close: Pages.Dashboard.Toolbar.toolbarItems('Close options pane'),
      open: Pages.Dashboard.Toolbar.toolbarItems('Open options pane'),
      select: 'Panel editor option pane select',
      tab: (title: string) => `Panel editor option pane tab ${title}`,
    },
    // not sure about the naming *DataPane*
    DataPane: {
      content: 'Panel editor data pane content',
    },
  },
  PanelInspector: {
    Data: {
      content: 'Panel inspector Data content',
    },
    Stats: {
      content: 'Panel inspector Stats content',
    },
    Json: {
      content: 'Panel inspector Json content',
    },
    Query: {
      content: 'Panel inspector Query content',
      refreshButton: 'Panel inspector Query refresh button',
      jsonObjectKeys: () => '.json-formatter-key',
    },
  },
  Tab: {
    title: (title: string) => `Tab ${title}`,
    active: () => '[class*="-activeTabStyle"]',
  },
  QueryTab: {
    content: 'Query editor tab content',
    queryInspectorButton: 'Query inspector button',
    addQuery: 'Query editor add query button',
  },
  QueryEditorRows: {
    rows: 'Query editor row',
  },
  QueryEditorRow: {
    actionButton: (title: string) => `${title} query operation action`,
    title: (refId: string) => `Query editor row title ${refId}`,
  },
  AlertTab: {
    content: 'Alert editor tab content',
  },
  Alert: {
    alert: (severity: string) => `Alert ${severity}`,
  },
  TransformTab: {
    content: 'Transform editor tab content',
    newTransform: (name: string) => `New transform ${name}`,
    transformationEditor: (name: string) => `Transformation editor ${name}`,
    transformationEditorDebugger: (name: string) => `Transformation editor debugger ${name}`,
  },
  Transforms: {
    Reduce: {
      calculationsLabel: 'Transform calculations label',
    },
  },
  QueryEditorToolbarItem: {
    button: (title: string) => `QueryEditor toolbar item button ${title}`,
  },
  BackButton: {
    backArrow: 'Go Back button',
  },
  OptionsGroup: {
    toggle: (title: string) => `Options group ${title}`,
  },
  PluginVisualization: {
    item: (title: string) => `Plugin visualization item ${title}`,
    current: () => '[class*="-currentVisualizationItem"]',
  },
  Select: {
    option: 'Select option',
    input: () => 'input[id*="react-select-"]',
    singleValue: () => 'div[class*="-singleValue"]',
  },
  FieldConfigEditor: {
    content: 'Field config editor content',
  },
  OverridesConfigEditor: {
    content: 'Field overrides editor content',
  },
  FolderPicker: {
    container: 'Folder picker select container',
  },
  DataSourcePicker: {
    container: 'Data source picker select container',
  },
  TimeZonePicker: {
    container: 'Time zone picker select container',
  },
  QueryField: { container: 'Query field' },
  ValuePicker: {
    select: (name: string) => `Value picker select ${name}`,
  },
  Search: {
    section: 'Search section',
    items: 'Search items',
  },
  DashboardLinks: {
    container: 'Dashboard link container',
    dropDown: 'Dashboard link dropdown',
    link: 'Dashboard link',
  },
};
