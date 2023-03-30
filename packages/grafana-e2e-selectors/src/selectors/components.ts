// NOTE: by default Component string selectors are set up to be aria-labels,
// however there are many cases where your component may not need an aria-label
// (a <button> with clear text, for example, does not need an aria-label as it's already labeled)
// but you still might need to select it for testing,
// in that case please add the attribute data-test-id={selector} in the component and
// prefix your selector string with 'data-test-id' so that when create the selectors we know to search for it on the right attribute
/**
 * Selectors grouped/defined in Components
 *
 * @alpha
 */
export const Components = {
  Breadcrumbs: {
    breadcrumb: (title: string) => `data-testid ${title} breadcrumb`,
  },
  TimePicker: {
    openButton: 'data-testid TimePicker Open Button',
    fromField: 'Time Range from field',
    toField: 'Time Range to field',
    applyTimeRange: 'data-testid TimePicker submit button',
    calendar: {
      label: 'Time Range calendar',
      openButton: 'Open time range calendar',
      closeButton: 'Close time range Calendar',
    },
    absoluteTimeRangeTitle: 'data-testid-absolute-time-range-narrow',
  },
  DataSourcePermissions: {
    form: () => 'form[name="addPermission"]',
    roleType: 'Role to add new permission to',
    rolePicker: 'Built-in role picker',
    permissionLevel: 'Permission Level',
  },
  DataSource: {
    TestData: {
      QueryTab: {
        scenarioSelectContainer: 'Test Data Query scenario select container',
        scenarioSelect: 'Test Data Query scenario select',
        max: 'TestData max',
        min: 'TestData min',
        noise: 'TestData noise',
        seriesCount: 'TestData series count',
        spread: 'TestData spread',
        startValue: 'TestData start value',
        drop: 'TestData drop values',
      },
    },
    DataSourceHttpSettings: {
      urlInput: 'Datasource HTTP settings url',
    },
    Jaeger: {
      traceIDInput: 'Trace ID',
    },
    Prometheus: {
      configPage: {
        exemplarsAddButton: 'Add exemplar config button',
        internalLinkSwitch: 'Internal link switch',
      },
      exemplarMarker: 'Exemplar marker',
    },
  },
  Menu: {
    MenuComponent: (title: string) => `${title} menu`,
    MenuGroup: (title: string) => `${title} menu group`,
    MenuItem: (title: string) => `${title} menu item`,
    SubMenu: {
      container: 'SubMenu container',
      icon: 'SubMenu icon',
    },
  },
  Panels: {
    Panel: {
      title: (title: string) => `data-testid Panel header ${title}`,
      headerItems: (item: string) => `Panel header item ${item}`,
      menuItems: (item: string) => `data-testid Panel menu item ${item}`,
      containerByTitle: (title: string) => `${title} panel`,
      headerCornerInfo: (mode: string) => `Panel header ${mode}`,
    },
    Visualization: {
      Graph: {
        container: 'Graph container',
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
        /**
         * @deprecated use valueV2 from Grafana 8.3 instead
         */
        value: 'Bar gauge value',
        valueV2: 'data-testid Bar gauge value',
      },
      PieChart: {
        svgSlice: 'Pie Chart Slice',
      },
      Text: {
        container: () => '.markdown-html',
      },
      Table: {
        header: 'table header',
        footer: 'table-footer',
      },
    },
  },
  VizLegend: {
    seriesName: (name: string) => `VizLegend series ${name}`,
  },
  Drawer: {
    General: {
      title: (title: string) => `Drawer title ${title}`,
      expand: 'Drawer expand',
      contract: 'Drawer contract',
      close: 'Drawer close',
      rcContentWrapper: () => '.rc-drawer-content-wrapper',
    },
  },
  PanelEditor: {
    General: {
      content: 'Panel editor content',
    },
    OptionsPane: {
      content: 'Panel editor option pane content',
      select: 'Panel editor option pane select',
      fieldLabel: (type: string) => `${type} field property editor`,
    },
    // not sure about the naming *DataPane*
    DataPane: {
      content: 'Panel editor data pane content',
    },
    applyButton: 'data-testid Apply changes and go back to dashboard',
    toggleVizPicker: 'toggle-viz-picker',
    toggleVizOptions: 'toggle-viz-options',
    toggleTableView: 'toggle-table-view',

    // [Geomap] Map controls
    measureButton: 'show measure tools',
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
  RefreshPicker: {
    /**
     * @deprecated use runButtonV2 from Grafana 8.3 instead
     */
    runButton: 'RefreshPicker run button',
    /**
     * @deprecated use intervalButtonV2 from Grafana 8.3 instead
     */
    intervalButton: 'RefreshPicker interval button',
    runButtonV2: 'data-testid RefreshPicker run button',
    intervalButtonV2: 'data-testid RefreshPicker interval button',
  },
  QueryTab: {
    content: 'Query editor tab content',
    queryInspectorButton: 'Query inspector button',
    queryHistoryButton: 'Rich history button',
    addQuery: 'Query editor add query button',
  },
  QueryHistory: {
    queryText: 'Query text',
  },
  QueryEditorRows: {
    rows: 'Query editor row',
  },
  QueryEditorRow: {
    actionButton: (title: string) => `${title} query operation action`,
    title: (refId: string) => `Query editor row title ${refId}`,
    container: (refId: string) => `Query editor row ${refId}`,
  },
  AlertTab: {
    content: 'Alert editor tab content',
  },
  Alert: {
    /**
     * @deprecated use alertV2 from Grafana 8.3 instead
     */
    alert: (severity: string) => `Alert ${severity}`,
    alertV2: (severity: string) => `data-testid Alert ${severity}`,
  },
  TransformTab: {
    content: 'Transform editor tab content',
    newTransform: (name: string) => `New transform ${name}`,
    transformationEditor: (name: string) => `Transformation editor ${name}`,
    transformationEditorDebugger: (name: string) => `Transformation editor debugger ${name}`,
  },
  Transforms: {
    card: (name: string) => `New transform ${name}`,
    Reduce: {
      modeLabel: 'Transform mode label',
      calculationsLabel: 'Transform calculations label',
    },
    SpatialOperations: {
      actionLabel: 'root Action field property editor',
      locationLabel: 'root Location field property editor',
      location: {
        autoOption: 'Auto location option',
        coords: {
          option: 'Coords location option',
          latitudeFieldLabel: 'root Latitude field field property editor',
          longitudeFieldLabel: 'root Longitude field field property editor',
        },
        geohash: {
          option: 'Geohash location option',
          geohashFieldLabel: 'root Geohash field field property editor',
        },
        lookup: {
          option: 'Lookup location option',
          lookupFieldLabel: 'root Lookup field field property editor',
          gazetteerFieldLabel: 'root Gazetteer field property editor',
        },
      },
    },
    searchInput: 'search transformations',
  },
  NavBar: {
    Configuration: {
      button: 'Configuration',
    },
    Toggle: {
      button: 'Toggle menu',
    },
    Reporting: {
      button: 'Reporting',
    },
  },
  NavToolbar: {
    container: 'data-testid Nav toolbar',
  },
  PageToolbar: {
    container: () => '.page-toolbar',
    item: (tooltip: string) => `${tooltip}`,
  },
  QueryEditorToolbarItem: {
    button: (title: string) => `QueryEditor toolbar item button ${title}`,
  },
  BackButton: {
    backArrow: 'Go Back',
  },
  OptionsGroup: {
    group: (title?: string) => (title ? `Options group ${title}` : 'Options group'),
    toggle: (title?: string) => (title ? `Options group ${title} toggle` : 'Options group toggle'),
  },
  PluginVisualization: {
    item: (title: string) => `Plugin visualization item ${title}`,
    current: () => '[class*="-currentVisualizationItem"]',
  },
  Select: {
    option: 'Select option',
    input: () => 'input[id*="time-options-input"]',
    singleValue: () => 'div[class*="-singleValue"]',
  },
  FieldConfigEditor: {
    content: 'Field config editor content',
  },
  OverridesConfigEditor: {
    content: 'Field overrides editor content',
  },
  FolderPicker: {
    /**
     * @deprecated use containerV2 from Grafana 8.3 instead
     */
    container: 'Folder picker select container',
    containerV2: 'data-testid Folder picker select container',
    input: 'Select a folder',
  },
  ReadonlyFolderPicker: {
    container: 'data-testid Readonly folder picker select container',
  },
  DataSourcePicker: {
    container: 'Data source picker select container',
    /**
     * @deprecated use inputV2 instead
     */
    input: () => 'input[id="data-source-picker"]',
    inputV2: 'Select a data source',
  },
  TimeZonePicker: {
    /**
     * @deprecated use TimeZonePicker.containerV2 from Grafana 8.3 instead
     */
    container: 'Time zone picker select container',
    containerV2: 'data-testid Time zone picker select container',
  },
  WeekStartPicker: {
    /**
     * @deprecated use WeekStartPicker.containerV2 from Grafana 8.3 instead
     */
    container: 'Choose starting day of the week',
    containerV2: 'data-testid Choose starting day of the week',
    placeholder: 'Choose starting day of the week',
  },
  TraceViewer: {
    spanBar: 'data-testid SpanBar--wrapper',
  },
  QueryField: { container: 'Query field' },
  QueryBuilder: {
    queryPatterns: 'Query patterns',
    labelSelect: 'Select label',
    valueSelect: 'Select value',
    matchOperatorSelect: 'Select match operator',
  },
  ValuePicker: {
    button: (name: string) => `Value picker button ${name}`,
    select: (name: string) => `Value picker select ${name}`,
  },
  Search: {
    /**
     * @deprecated use sectionV2 from Grafana 8.3 instead
     */
    section: 'Search section',
    sectionV2: 'data-testid Search section',
    /**
     * @deprecated use itemsV2 from Grafana 8.3 instead
     */
    items: 'Search items',
    itemsV2: 'data-testid Search items',
    cards: 'data-testid Search cards',
    collapseFolder: (sectionId: string) => `data-testid Collapse folder ${sectionId}`,
    expandFolder: (sectionId: string) => `data-testid Expand folder ${sectionId}`,
    dashboardItem: (item: string) => `${Components.Search.dashboardItems} ${item}`,
    dashboardCard: (item: string) => `data-testid Search card ${item}`,
    folderHeader: (folderName: string) => `data-testid Folder header ${folderName}`,
    folderContent: (folderName: string) => `data-testid Folder content ${folderName}`,
    dashboardItems: 'data-testid Dashboard search item',
  },
  DashboardLinks: {
    container: 'data-testid Dashboard link container',
    dropDown: 'data-testid Dashboard link dropdown',
    link: 'data-testid Dashboard link',
  },
  LoadingIndicator: {
    icon: 'Loading indicator',
  },
  CallToActionCard: {
    /**
     * @deprecated use buttonV2 from Grafana 8.3 instead
     */
    button: (name: string) => `Call to action button ${name}`,
    buttonV2: (name: string) => `data-testid Call to action button ${name}`,
  },
  DataLinksContextMenu: {
    singleLink: 'Data link',
  },
  CodeEditor: {
    container: 'Code editor container',
  },
  DashboardImportPage: {
    textarea: 'data-testid-import-dashboard-textarea',
    submit: 'data-testid-load-dashboard',
  },
  ImportDashboardForm: {
    name: 'data-testid-import-dashboard-title',
    submit: 'data-testid-import-dashboard-submit',
  },
  PanelAlertTabContent: {
    content: 'Unified alert editor tab content',
  },
  VisualizationPreview: {
    card: (name: string) => `data-testid suggestion-${name}`,
  },
  ColorSwatch: {
    name: `data-testid-colorswatch`,
  },
  DashboardRow: {
    title: (title: string) => `data-testid dashboard-row-title-${title}`,
  },
  UserProfile: {
    profileSaveButton: 'data-testid-user-profile-save',
    preferencesSaveButton: 'data-testid-shared-prefs-save',
    orgsTable: 'data-testid-user-orgs-table',
    sessionsTable: 'data-testid-user-sessions-table',
  },
  FileUpload: {
    inputField: 'data-testid-file-upload-input-field',
    fileNameSpan: 'data-testid-file-upload-file-name',
  },
  DebugOverlay: {
    wrapper: 'debug-overlay',
  },
  OrgRolePicker: {
    input: 'Role',
  },
  AnalyticsToolbarButton: {
    button: 'Dashboard insights',
  },
  Variables: {
    variableOption: 'data-testid variable-option',
  },
};
