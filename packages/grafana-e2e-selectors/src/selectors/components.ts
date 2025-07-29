// NOTE: by default Component string selectors are set up to be aria-labels,
// however there are many cases where your component may not need an aria-label
// (a <button> with clear text, for example, does not need an aria-label as it's already labeled)
// but you still might need to select it for testing,
// in that case please add the attribute data-testid={selector} in the component and
// prefix your selector string with 'data-testid' so that when create the selectors we know to search for it on the right attribute

import { VersionedSelectorGroup } from '../types';

import { MIN_GRAFANA_VERSION } from './constants';

/**
 * Selectors grouped/defined in Components
 */
export const versionedComponents = {
  RadioButton: {
    container: {
      '10.2.3': 'data-testid radio-button',
    },
  },
  Breadcrumbs: {
    breadcrumb: {
      '9.4.0': (title: string) => `data-testid ${title} breadcrumb`,
    },
  },
  CanvasGridAddActions: {
    addPanel: {
      '12.1.0': 'data-testid CanvasGridAddActions add-panel',
    },
    groupPanels: {
      '12.1.0': 'data-testid CanvasGridAddActions group-panels',
    },
    ungroup: {
      '12.1.0': 'data-testid CanvasGridAddActions ungroup',
    },
    addRow: {
      '12.1.0': 'data-testid CanvasGridAddActions add-row',
    },
    pasteRow: {
      '12.1.0': 'data-testid CanvasGridAddActions paste-row',
    },
    addTab: {
      '12.1.0': 'data-testid CanvasGridAddActions add-tab',
    },
    pasteTab: {
      '12.1.0': 'data-testid CanvasGridAddActions paste-tab',
    },
  },
  DashboardEditPaneSplitter: {
    primaryBody: {
      '12.1.0': 'data-testid DashboardEditPaneSplitter primary body',
    },
  },
  EditPaneHeader: {
    deleteButton: {
      '12.1.0': 'data-testid EditPaneHeader delete panel',
    },
    copyDropdown: {
      '12.1.0': 'data-testid EditPaneHeader copy dropdown',
    },
    copy: {
      '12.1.0': 'data-testid EditPaneHeader copy',
    },
    duplicate: {
      '12.1.0': 'data-testid EditPaneHeader duplicate',
    },
    backButton: {
      '12.1.0': 'data-testid EditPaneHeader back',
    },
  },
  TimePicker: {
    openButton: {
      [MIN_GRAFANA_VERSION]: 'data-testid TimePicker Open Button',
    },
    overlayContent: {
      '10.2.3': 'data-testid TimePicker Overlay Content',
    },
    fromField: {
      '10.2.3': 'data-testid Time Range from field',
      [MIN_GRAFANA_VERSION]: 'Time Range from field',
    },
    toField: {
      '10.2.3': 'data-testid Time Range to field',
      [MIN_GRAFANA_VERSION]: 'Time Range to field',
    },
    applyTimeRange: {
      [MIN_GRAFANA_VERSION]: 'data-testid TimePicker submit button',
    },
    copyTimeRange: {
      '10.4.0': 'data-testid TimePicker copy button',
    },
    pasteTimeRange: {
      '10.4.0': 'data-testid TimePicker paste button',
    },
    calendar: {
      label: {
        '10.2.3': 'data-testid Time Range calendar',
        [MIN_GRAFANA_VERSION]: 'Time Range calendar',
      },
      openButton: {
        '10.2.3': 'data-testid Open time range calendar',
        [MIN_GRAFANA_VERSION]: 'Open time range calendar',
      },
      closeButton: {
        '10.2.3': 'data-testid Close time range Calendar',
        [MIN_GRAFANA_VERSION]: 'Close time range Calendar',
      },
    },
    absoluteTimeRangeTitle: {
      [MIN_GRAFANA_VERSION]: 'data-testid-absolute-time-range-narrow',
    },
  },
  DataSourcePermissions: {
    form: { '9.5.0': () => 'form[name="addPermission"]' },
    roleType: {
      '9.5.0': 'Role to add new permission to',
    },
    rolePicker: {
      '9.5.0': 'Built-in role picker',
    },
    permissionLevel: {
      '12.0.0': 'Permission level',
      '9.5.0': 'Permission Level',
    },
  },
  DateTimePicker: {
    input: {
      '10.2.3': 'data-testid date-time-input',
    },
  },
  DataSource: {
    TestData: {
      QueryTab: {
        scenarioSelectContainer: {
          [MIN_GRAFANA_VERSION]: 'Test Data Query scenario select container',
        },
        scenarioSelect: {
          [MIN_GRAFANA_VERSION]: 'Test Data Query scenario select',
        },
        max: {
          [MIN_GRAFANA_VERSION]: 'TestData max',
        },
        min: {
          [MIN_GRAFANA_VERSION]: 'TestData min',
        },
        noise: {
          [MIN_GRAFANA_VERSION]: 'TestData noise',
        },
        seriesCount: {
          [MIN_GRAFANA_VERSION]: 'TestData series count',
        },
        spread: {
          [MIN_GRAFANA_VERSION]: 'TestData spread',
        },
        startValue: {
          [MIN_GRAFANA_VERSION]: 'TestData start value',
        },
        drop: {
          [MIN_GRAFANA_VERSION]: 'TestData drop values',
        },
      },
    },
    DataSourceHttpSettings: {
      urlInput: {
        '10.4.0': 'data-testid Datasource HTTP settings url',
        [MIN_GRAFANA_VERSION]: 'Datasource HTTP settings url',
      },
    },
    Jaeger: {
      traceIDInput: {
        [MIN_GRAFANA_VERSION]: 'Trace ID',
      },
    },
    Prometheus: {
      configPage: {
        connectionSettings: {
          [MIN_GRAFANA_VERSION]: 'Data source connection URL', // aria-label in grafana experimental
        },
        manageAlerts: {
          '10.4.0': 'prometheus-alerts-manager', // id for switch component
        },
        allowAsRecordingRulesTarget: {
          '12.1.0': 'prometheus-recording-rules-target',
        },
        scrapeInterval: {
          '10.4.0': 'data-testid scrape interval',
        },
        queryTimeout: {
          '10.4.0': 'data-testid query timeout',
        },
        defaultEditor: {
          '10.4.0': 'data-testid default editor',
        },
        disableMetricLookup: {
          '10.4.0': 'disable-metric-lookup', // id for switch component
        },
        prometheusType: {
          '10.4.0': 'data-testid prometheus type',
        },
        prometheusVersion: {
          '10.4.0': 'data-testid prometheus version',
        },
        cacheLevel: {
          '10.4.0': 'data-testid cache level',
        },
        incrementalQuerying: {
          '10.4.0': 'prometheus-incremental-querying', // id for switch component
        },
        queryOverlapWindow: {
          '10.4.0': 'data-testid query overlap window',
        },
        disableRecordingRules: {
          '10.4.0': 'disable-recording-rules', // id for switch component
        },
        customQueryParameters: {
          '10.4.0': 'data-testid custom query parameters',
        },
        httpMethod: {
          '10.4.0': 'data-testid http method',
        },
        exemplarsAddButton: {
          '10.3.0': 'data-testid Add exemplar config button',
          [MIN_GRAFANA_VERSION]: 'Add exemplar config button',
        },
        internalLinkSwitch: {
          '10.3.0': 'data-testid Internal link switch',
          [MIN_GRAFANA_VERSION]: 'Internal link switch',
        },
        codeModeMetricNamesSuggestionLimit: {
          '11.1.0': 'data-testid code mode metric names suggestion limit',
        },
        seriesLimit: {
          '12.0.2': 'data-testid maximum series limit',
        },
      },
      queryEditor: {
        explain: {
          '10.4.0': 'data-testid prometheus explain switch wrapper',
        },
        editorToggle: {
          '10.4.0': 'data-testid QueryEditorModeToggle', // wrapper for toggle
        },
        options: {
          '10.4.0': 'data-testid prometheus options', // wrapper for options group
        },
        legend: {
          '10.4.0': 'data-testid prometheus legend wrapper', // wrapper for multiple compomnents
        },
        format: {
          '10.4.0': 'data-testid prometheus format',
        },
        step: {
          '10.4.0': 'data-testid prometheus-step', // id for autosize component
        },
        type: {
          '10.4.0': 'data-testid prometheus type', //wrapper for radio button group
        },
        exemplars: {
          '10.4.0': 'data-testid prometheus-exemplars', // id for editor switch component
        },
        builder: {
          // see QueryBuilder below for commented selectors
          metricSelect: {
            '10.4.0': 'data-testid metric select',
          },
          hints: {
            '10.4.0': 'data-testid prometheus hints', // wrapper for hints component
          },
          metricsExplorer: {
            '10.4.0': 'data-testid metrics explorer',
          },
          queryAdvisor: {
            '10.4.0': 'data-testid query advisor',
          },
        },
        code: {
          queryField: {
            '10.4.0': 'data-testid prometheus query field',
          },
          metricsCountInfo: {
            '11.1.0': 'data-testid metrics count disclaimer',
          },
          metricsBrowser: {
            openButton: {
              '10.4.0': 'data-testid open metrics browser',
            },
            selectMetric: {
              '10.4.0': 'data-testid select a metric',
            },
            seriesLimit: {
              '10.3.1': 'data-testid series limit',
            },
            metricList: {
              '10.4.0': 'data-testid metric list',
            },
            labelNamesFilter: {
              '10.4.0': 'data-testid label names filter',
            },
            labelValuesFilter: {
              '10.4.0': 'data-testid label values filter',
            },
            useQuery: {
              '10.4.0': 'data-testid use query',
            },
            useAsRateQuery: {
              '10.4.0': 'data-testid use as rate query',
            },
            validateSelector: {
              '10.4.0': 'data-testid validate selector',
            },
            clear: {
              '10.4.0': 'data-testid clear',
            },
          },
        },
      },
      exemplarMarker: {
        '10.3.0': 'data-testid Exemplar marker',
        [MIN_GRAFANA_VERSION]: 'Exemplar marker',
      },
      variableQueryEditor: {
        queryType: {
          '10.4.0': 'data-testid query type',
        },
        labelnames: {
          metricRegex: {
            '10.4.0': 'data-testid label names metric regex',
          },
        },
        labelValues: {
          labelSelect: {
            '10.4.0': 'data-testid label values label select',
          },
        },
        metricNames: {
          metricRegex: {
            '10.4.0': 'data-testid metric names metric regex',
          },
        },
        varQueryResult: {
          '10.4.0': 'data-testid variable query result',
        },
        seriesQuery: {
          '10.4.0': 'data-testid prometheus series query',
        },
        classicQuery: {
          '10.4.0': 'data-testid prometheus classic query',
        },
      },
      annotations: {
        minStep: {
          '10.4.0': 'data-testid prometheus-annotation-min-step', // id for autosize input
        },
        title: {
          '10.4.0': 'data-testid prometheus annotation title',
        },
        tags: {
          '10.4.0': 'data-testid prometheus annotation tags',
        },
        text: {
          '10.4.0': 'data-testid prometheus annotation text',
        },
        seriesValueAsTimestamp: {
          '10.4.0': 'data-testid prometheus annotation series value as timestamp',
        },
      },
    },
  },
  Menu: {
    MenuComponent: {
      [MIN_GRAFANA_VERSION]: (title: string) => `${title} menu`,
    },
    MenuGroup: {
      [MIN_GRAFANA_VERSION]: (title: string) => `${title} menu group`,
    },
    MenuItem: {
      [MIN_GRAFANA_VERSION]: (title: string) => `${title} menu item`,
    },
    SubMenu: {
      container: {
        '10.3.0': 'data-testid SubMenu container',
        [MIN_GRAFANA_VERSION]: 'SubMenu container',
      },
      icon: {
        '10.3.0': 'data-testid SubMenu icon',
        [MIN_GRAFANA_VERSION]: 'SubMenu icon',
      },
    },
  },
  Panels: {
    Panel: {
      title: {
        [MIN_GRAFANA_VERSION]: (title: string) => `data-testid Panel header ${title}`,
      },
      content: {
        '11.1.0': 'data-testid panel content',
      },
      headerContainer: {
        '9.5.0': 'data-testid header-container',
      },
      headerItems: {
        '10.2.0': (item: string) => `data-testid Panel header item ${item}`,
      },
      menuItems: {
        '9.5.0': (item: string) => `data-testid Panel menu item ${item}`,
      },
      menu: {
        '9.5.0': (title: string) => `data-testid Panel menu ${title}`,
      },
      containerByTitle: {
        [MIN_GRAFANA_VERSION]: (title: string) => `${title} panel`,
      },
      headerCornerInfo: {
        [MIN_GRAFANA_VERSION]: (mode: string) => `Panel header ${mode}`,
      },
      status: {
        '10.2.0': (status: string) => `data-testid Panel status ${status}`,
        [MIN_GRAFANA_VERSION]: (_: string) => 'Panel status',
      },
      loadingBar: {
        '10.0.0': () => `Panel loading bar`,
      },
      HoverWidget: {
        container: {
          '10.1.0': 'data-testid hover-header-container',
          [MIN_GRAFANA_VERSION]: 'hover-header-container',
        },
        dragIcon: {
          '10.0.0': 'data-testid drag-icon',
        },
      },
      PanelDataErrorMessage: {
        '10.4.0': 'data-testid Panel data error message',
      },
    },
    Visualization: {
      Graph: {
        container: {
          '9.5.0': 'Graph container',
        },
        VisualizationTab: {
          legendSection: {
            [MIN_GRAFANA_VERSION]: 'Legend section',
          },
        },
        Legend: {
          legendItemAlias: {
            [MIN_GRAFANA_VERSION]: (name: string) => `gpl alias ${name}`,
          },
          showLegendSwitch: {
            [MIN_GRAFANA_VERSION]: 'gpl show legend',
          },
        },
        xAxis: {
          labels: {
            [MIN_GRAFANA_VERSION]: () => 'div.flot-x-axis > div.flot-tick-label',
          },
        },
      },
      BarGauge: {
        valueV2: {
          [MIN_GRAFANA_VERSION]: 'data-testid Bar gauge value',
        },
      },
      PieChart: {
        svgSlice: {
          '10.3.0': 'data testid Pie Chart Slice',
        },
      },
      Text: {
        container: { [MIN_GRAFANA_VERSION]: () => '.markdown-html' },
      },
      Table: {
        header: {
          [MIN_GRAFANA_VERSION]: 'table header',
        },
        footer: {
          [MIN_GRAFANA_VERSION]: 'table-footer',
        },
        body: {
          '10.2.0': 'data-testid table body',
        },
      },
      TableNG: {
        Filters: {
          HeaderButton: {
            '12.1.0': 'data-testid tableng header filter',
          },
          Container: {
            '12.1.0': 'data-testid tablenf filter container',
          },
          SelectAll: {
            '12.1.0': 'data-testid tableng filter select-all',
          },
        },
      },
    },
  },
  VizLegend: {
    seriesName: {
      '10.3.0': (name: string) => `data-testid VizLegend series ${name}`,
    },
  },
  Drawer: {
    General: {
      title: {
        [MIN_GRAFANA_VERSION]: (title: string) => `Drawer title ${title}`,
      },
      expand: {
        [MIN_GRAFANA_VERSION]: 'Drawer expand',
      },
      contract: {
        [MIN_GRAFANA_VERSION]: 'Drawer contract',
      },
      close: {
        '10.3.0': 'data-testid Drawer close',
        [MIN_GRAFANA_VERSION]: 'Drawer close',
      },
      rcContentWrapper: { '9.4.0': () => '.rc-drawer-content-wrapper' },
      subtitle: {
        '10.4.0': 'data-testid drawer subtitle',
      },
    },
    DashboardSaveDrawer: {
      saveButton: {
        '11.1.0': 'data-testid Save dashboard drawer button',
      },
      saveAsButton: {
        '11.1.0': 'data-testid Save as dashboard drawer button',
      },
      saveAsTitleInput: {
        '11.1.0': 'Save dashboard title field',
      },
    },
  },
  PanelEditor: {
    General: {
      content: {
        '11.1.0': 'data-testid Panel editor content',
        '8.0.0': 'Panel editor content',
      },
    },
    OptionsPane: {
      content: {
        '11.1.0': 'data-testid Panel editor option pane content',
        [MIN_GRAFANA_VERSION]: 'Panel editor option pane content',
      },
      select: {
        [MIN_GRAFANA_VERSION]: 'Panel editor option pane select',
      },
      fieldLabel: {
        [MIN_GRAFANA_VERSION]: (type: string) => `${type} field property editor`,
      },
      fieldInput: {
        '11.0.0': (title: string) => `data-testid Panel editor option pane field input ${title}`,
      },
    },
    DataPane: {
      content: {
        '11.1.0': 'data-testid Panel editor data pane content',
        [MIN_GRAFANA_VERSION]: 'Panel editor data pane content',
      },
    },
    applyButton: {
      '9.2.0': 'data-testid Apply changes and go back to dashboard',
      '9.1.0': 'Apply changes and go back to dashboard',
      '8.0.0': 'panel editor apply',
    },
    toggleVizPicker: {
      '10.0.0': 'data-testid toggle-viz-picker',
      '8.0.0': 'toggle-viz-picker',
    },
    toggleVizOptions: {
      '10.1.0': 'data-testid toggle-viz-options',
      [MIN_GRAFANA_VERSION]: 'toggle-viz-options',
    },
    toggleTableView: {
      '11.1.0': 'data-testid toggle-table-view',
      [MIN_GRAFANA_VERSION]: 'toggle-table-view',
    },

    // [Geomap] Map controls
    showZoomField: {
      '10.2.0': 'Map controls Show zoom control field property editor',
    },
    showAttributionField: {
      '10.2.0': 'Map controls Show attribution field property editor',
    },
    showScaleField: {
      '10.2.0': 'Map controls Show scale field property editor',
    },
    showMeasureField: {
      '10.2.0': 'Map controls Show measure tools field property editor',
    },
    showDebugField: {
      '10.2.0': 'Map controls Show debug field property editor',
    },

    measureButton: {
      '12.1.0': 'data-testid panel-editor-measure-button',
      '9.2.0': 'show measure tools',
    },

    Outline: {
      section: {
        '12.0.0': 'data-testid Outline section',
      },
      node: {
        '12.0.0': (type: string) => `data-testid outline node ${type}`,
      },
      item: {
        '12.0.0': (type: string) => `data-testid outline item ${type}`,
      },
    },
    ElementEditPane: {
      variableType: {
        '12.0.0': (type?: string) => `data-testid variable type ${type}`,
      },
      addVariableButton: {
        '12.0.0': 'data-testid add variable button',
      },
      variableNameInput: {
        '12.0.0': 'data-testid variable name input',
      },
      variableLabelInput: {
        '12.0.0': 'data-testid variable label input',
      },
      AutoGridLayout: {
        minColumnWidth: {
          '12.1.0': 'data-testid min column width selector',
        },
        customMinColumnWidth: {
          '12.1.0': 'data-testid custom min column width input',
        },
        clearCustomMinColumnWidth: {
          '12.1.0': 'data-testid clear custom min column width input',
        },
        maxColumns: {
          '12.1.0': 'data-testid max columns selector',
        },
        rowHeight: {
          '12.1.0': 'data-testid row height selector',
        },
        customRowHeight: {
          '12.1.0': 'data-testid custom row height input',
        },
        clearCustomRowHeight: {
          '12.1.0': 'data-testid clear custom row height input',
        },
        fillScreen: {
          '12.1.0': 'data-testid fill screen switch',
        },
      },
    },
  },
  PanelInspector: {
    Data: {
      content: {
        [MIN_GRAFANA_VERSION]: 'Panel inspector Data content',
      },
    },
    Stats: {
      content: {
        [MIN_GRAFANA_VERSION]: 'Panel inspector Stats content',
      },
    },
    Json: {
      content: {
        '11.1.0': 'data-testid Panel inspector Json content',
        [MIN_GRAFANA_VERSION]: 'Panel inspector Json content',
      },
    },
    Query: {
      content: {
        [MIN_GRAFANA_VERSION]: 'Panel inspector Query content',
      },
      refreshButton: {
        [MIN_GRAFANA_VERSION]: 'Panel inspector Query refresh button',
      },
      jsonObjectKeys: {
        [MIN_GRAFANA_VERSION]: () => '.json-formatter-key',
      },
    },
  },
  Tab: {
    title: {
      '11.2.0': (title: string) => `data-testid Tab ${title}`,
    },
    active: { [MIN_GRAFANA_VERSION]: () => '[class*="-activeTabStyle"]' },
  },
  RefreshPicker: {
    runButtonV2: {
      [MIN_GRAFANA_VERSION]: 'data-testid RefreshPicker run button',
    },
    intervalButtonV2: {
      [MIN_GRAFANA_VERSION]: 'data-testid RefreshPicker interval button',
    },
  },
  QueryTab: {
    content: {
      [MIN_GRAFANA_VERSION]: 'Query editor tab content',
    },
    queryInspectorButton: {
      [MIN_GRAFANA_VERSION]: 'Query inspector button',
    },
    queryHistoryButton: {
      '10.2.0': 'data-testid query-history-button',
      [MIN_GRAFANA_VERSION]: 'query-history-button',
    },
    addQuery: {
      '10.2.0': 'data-testid query-tab-add-query',
      [MIN_GRAFANA_VERSION]: 'Query editor add query button',
    },
    addQueryFromLibrary: {
      '11.5.0': 'data-testid query-tab-add-query-from-library',
    },
    queryGroupTopSection: {
      '11.2.0': 'data-testid query group top section',
    },
    addExpression: {
      '11.2.0': 'data-testid query-tab-add-expression',
    },
  },
  QueryHistory: {
    queryText: {
      '9.0.0': 'Query text',
    },
  },
  QueryEditorRows: {
    rows: {
      [MIN_GRAFANA_VERSION]: 'Query editor row',
    },
  },
  QueryEditorRow: {
    actionButton: {
      '10.4.0': (title: string) => `data-testid ${title}`,
    },
    title: {
      [MIN_GRAFANA_VERSION]: (refId: string) => `Query editor row title ${refId}`,
    },
    container: {
      [MIN_GRAFANA_VERSION]: (refId: string) => `Query editor row ${refId}`,
    },
  },
  AlertTab: {
    content: {
      '10.2.3': 'data-testid Alert editor tab content',
      [MIN_GRAFANA_VERSION]: 'Alert editor tab content',
    },
  },
  AlertRules: {
    groupToggle: {
      '11.0.0': 'data-testid group-collapse-toggle',
    },
    toggle: {
      '11.0.0': 'data-testid collapse-toggle',
    },
    expandedContent: {
      '11.0.0': 'data-testid expanded-content',
    },
    previewButton: {
      '11.1.0': 'data-testid alert-rule preview-button',
    },
    ruleNameField: {
      '11.1.0': 'data-testid alert-rule name-field',
    },
    newFolderButton: {
      '11.1.0': 'data-testid alert-rule new-folder-button',
    },
    newFolderNameField: {
      '11.1.0': 'data-testid alert-rule name-folder-name-field',
    },
    newFolderNameCreateButton: {
      '11.1.0': 'data-testid alert-rule name-folder-name-create-button',
    },
    newEvaluationGroupButton: {
      '11.1.0': 'data-testid alert-rule new-evaluation-group-button',
    },
    newEvaluationGroupName: {
      '11.1.0': 'data-testid alert-rule new-evaluation-group-name',
    },
    newEvaluationGroupInterval: {
      '11.1.0': 'data-testid alert-rule new-evaluation-group-interval',
    },
    newEvaluationGroupCreate: {
      '11.1.0': 'data-testid alert-rule new-evaluation-group-create-button',
    },
    step: {
      '11.5.0': (stepNo: string) => `data-testid alert-rule step-${stepNo}`,
    },
    stepAdvancedModeSwitch: {
      '11.5.0': (stepNo: string) => `data-testid advanced-mode-switch step-${stepNo}`,
    },
  },
  Alert: {
    alertV2: {
      [MIN_GRAFANA_VERSION]: (severity: string) => `data-testid Alert ${severity}`,
    },
  },
  TransformTab: {
    content: {
      '10.1.0': 'data-testid Transform editor tab content',
      [MIN_GRAFANA_VERSION]: 'Transform editor tab content',
    },
    newTransform: {
      '10.1.0': (name: string) => `data-testid New transform ${name}`,
    },
    transformationEditor: {
      '10.1.0': (name: string) => `data-testid Transformation editor ${name}`,
    },
    transformationEditorDebugger: {
      '10.1.0': (name: string) => `data-testid Transformation editor debugger ${name}`,
    },
  },
  Transforms: {
    card: {
      '10.1.0': (name: string) => `data-testid New transform ${name}`,
    },
    disableTransformationButton: {
      '10.4.0': 'data-testid Disable transformation button',
    },
    Reduce: {
      modeLabel: {
        '10.2.3': 'data-testid Transform mode label',
        [MIN_GRAFANA_VERSION]: 'Transform mode label',
      },
      calculationsLabel: {
        '10.2.3': 'data-testid Transform calculations label',
        [MIN_GRAFANA_VERSION]: 'Transform calculations label',
      },
    },
    SpatialOperations: {
      actionLabel: {
        '9.1.2': 'root Action field property editor',
      },
      locationLabel: {
        '10.2.0': 'root Location Mode field property editor',
      },
      location: {
        autoOption: {
          '9.1.2': 'Auto location option',
        },
        coords: {
          option: {
            '9.1.2': 'Coords location option',
          },
          latitudeFieldLabel: {
            '9.1.2': 'root Latitude field field property editor',
          },
          longitudeFieldLabel: {
            '9.1.2': 'root Longitude field field property editor',
          },
        },
        geohash: {
          option: {
            '9.1.2': 'Geohash location option',
          },
          geohashFieldLabel: {
            '9.1.2': 'root Geohash field field property editor',
          },
        },
        lookup: {
          option: {
            '9.1.2': 'Lookup location option',
          },
          lookupFieldLabel: {
            '9.1.2': 'root Lookup field field property editor',
          },
          gazetteerFieldLabel: {
            '9.1.2': 'root Gazetteer field property editor',
          },
        },
      },
    },
    searchInput: {
      '10.2.3': 'data-testid search transformations',
      [MIN_GRAFANA_VERSION]: 'search transformations',
    },
    noTransformationsMessage: {
      '10.2.3': 'data-testid no transformations message',
    },
    addTransformationButton: {
      '10.1.0': 'data-testid add transformation button',
      [MIN_GRAFANA_VERSION]: 'add transformation button',
    },
    removeAllTransformationsButton: {
      '10.4.0': 'data-testid remove all transformations button',
    },
  },
  NavBar: {
    Configuration: {
      button: {
        '9.5.0': 'Configuration',
      },
    },
    Toggle: {
      button: {
        '10.2.3': 'data-testid Toggle menu',
        [MIN_GRAFANA_VERSION]: 'Toggle menu',
      },
    },
    Reporting: {
      button: {
        '9.5.0': 'Reporting',
      },
    },
  },
  NavMenu: {
    Menu: {
      '10.2.3': 'data-testid navigation mega-menu',
    },
    item: {
      '9.5.0': 'data-testid Nav menu item',
    },
  },
  NavToolbar: {
    container: {
      '9.4.0': 'data-testid Nav toolbar',
    },
    commandPaletteTrigger: {
      '11.5.0': 'data-testid Command palette trigger',
    },
    shareDashboard: {
      '11.1.0': 'data-testid Share dashboard',
    },
    markAsFavorite: {
      '11.1.0': 'data-testid Mark as favorite',
    },
    editDashboard: {
      editButton: {
        '11.1.0': 'data-testid Edit dashboard button',
      },
      saveButton: {
        '11.1.0': 'data-testid Save dashboard button',
      },
      exitButton: {
        '11.1.0': 'data-testid Exit edit mode button',
      },
      settingsButton: {
        '11.1.0': 'data-testid Dashboard settings',
      },
      addRowButton: {
        '11.1.0': 'data-testid Add row button',
      },
      addLibraryPanelButton: {
        '11.1.0': 'data-testid Add a panel from the panel library button',
      },
      addVisualizationButton: {
        '11.1.0': 'data-testid Add new visualization menu item',
      },
      pastePanelButton: {
        '11.1.0': 'data-testid Paste panel button',
      },
      discardChangesButton: {
        '11.1.0': 'data-testid Discard changes button',
      },
      discardLibraryPanelButton: {
        '11.1.0': 'data-testid Discard library panel button',
      },
      unlinkLibraryPanelButton: {
        '11.1.0': 'data-testid Unlink library panel button',
      },
      saveLibraryPanelButton: {
        '11.1.0': 'data-testid Save library panel button',
      },
      backToDashboardButton: {
        '11.1.0': 'data-testid Back to dashboard button',
      },
    },
  },

  PageToolbar: {
    container: { [MIN_GRAFANA_VERSION]: () => '.page-toolbar' },
    item: {
      [MIN_GRAFANA_VERSION]: (tooltip: string) => `${tooltip}`,
    },
    itemButton: {
      '9.5.0': (title: string) => `data-testid ${title}`,
    },
  },
  QueryEditorToolbarItem: {
    button: {
      [MIN_GRAFANA_VERSION]: (title: string) => `QueryEditor toolbar item button ${title}`,
    },
  },
  BackButton: {
    backArrow: {
      '10.3.0': 'data-testid Go Back',
      [MIN_GRAFANA_VERSION]: 'Go Back',
    },
  },
  OptionsGroup: {
    group: {
      '11.1.0': (title?: string) => (title ? `data-testid Options group ${title}` : 'data-testid Options group'),
      [MIN_GRAFANA_VERSION]: (title?: string) => (title ? `Options group ${title}` : 'Options group'),
    },
    toggle: {
      '11.1.0': (title?: string) =>
        title ? `data-testid Options group ${title} toggle` : 'data-testid Options group toggle',
      [MIN_GRAFANA_VERSION]: (title?: string) => (title ? `Options group ${title} toggle` : 'Options group toggle'),
    },
  },
  PluginVisualization: {
    item: {
      [MIN_GRAFANA_VERSION]: (title: string) => `Plugin visualization item ${title}`,
    },
    current: {
      [MIN_GRAFANA_VERSION]: () => '[class*="-currentVisualizationItem"]',
    },
  },
  Select: {
    menu: {
      '11.5.0': 'data-testid Select menu',
      [MIN_GRAFANA_VERSION]: 'Select options menu',
    },
    option: {
      '11.1.0': 'data-testid Select option',
      [MIN_GRAFANA_VERSION]: 'Select option',
    },
    toggleAllOptions: {
      '11.3.0': 'data-testid toggle all options',
    },
    input: {
      [MIN_GRAFANA_VERSION]: () => 'input[id*="time-options-input"]',
    },
    singleValue: {
      [MIN_GRAFANA_VERSION]: () => 'div[class*="-singleValue"]',
    },
  },
  FieldConfigEditor: {
    content: {
      [MIN_GRAFANA_VERSION]: 'Field config editor content',
    },
  },
  OverridesConfigEditor: {
    content: {
      [MIN_GRAFANA_VERSION]: 'Field overrides editor content',
    },
  },
  FolderPicker: {
    containerV2: {
      [MIN_GRAFANA_VERSION]: 'data-testid Folder picker select container',
    },
    input: {
      '10.4.0': 'data-testid folder-picker-input',
    },
  },
  ReadonlyFolderPicker: {
    container: {
      [MIN_GRAFANA_VERSION]: 'data-testid Readonly folder picker select container',
    },
  },
  DataSourcePicker: {
    container: {
      '10.0.0': 'data-testid Data source picker select container',
      '8.0.0': 'Data source picker select container',
    },
    inputV2: {
      '10.1.0': 'data-testid Select a data source',
      [MIN_GRAFANA_VERSION]: 'Select a data source',
    },
    dataSourceList: {
      '10.4.0': 'data-testid Data source list dropdown',
    },
    advancedModal: {
      dataSourceList: {
        '10.4.0': 'data-testid Data source list',
      },
      builtInDataSourceList: {
        '10.4.0': 'data-testid Built in data source list',
      },
    },
  },
  TimeZonePicker: {
    containerV2: {
      [MIN_GRAFANA_VERSION]: 'data-testid Time zone picker select container',
    },
    changeTimeSettingsButton: {
      '11.0.0': 'data-testid Time zone picker Change time settings button',
    },
  },
  WeekStartPicker: {
    containerV2: {
      [MIN_GRAFANA_VERSION]: 'data-testid Choose starting day of the week',
    },
    placeholder: {
      [MIN_GRAFANA_VERSION]: 'Choose starting day of the week',
    },
  },
  TraceViewer: {
    spanBar: {
      '9.0.0': 'data-testid SpanBar--wrapper',
    },
  },
  QueryField: {
    container: {
      '10.3.0': 'data-testid Query field',
      [MIN_GRAFANA_VERSION]: 'Query field',
    },
  },
  QueryBuilder: {
    queryPatterns: {
      '10.3.0': 'data-testid Query patterns',
      [MIN_GRAFANA_VERSION]: 'Query patterns',
    },
    labelSelect: {
      '10.3.0': 'data-testid Select label',
      [MIN_GRAFANA_VERSION]: 'Select label',
    },
    inputSelect: {
      '11.1.0': 'data-testid Select label-input',
    },
    valueSelect: {
      '10.3.0': 'data-testid Select value',
      [MIN_GRAFANA_VERSION]: 'Select value',
    },
    matchOperatorSelect: {
      '10.3.0': 'data-testid Select match operator',
      [MIN_GRAFANA_VERSION]: 'Select match operator',
    },
  },
  ValuePicker: {
    button: {
      '10.3.0': (name: string) => `data-testid Value picker button ${name}`,
    },
    select: {
      '10.3.0': (name: string) => `data-testid Value picker select ${name}`,
    },
  },
  Search: {
    sectionV2: {
      [MIN_GRAFANA_VERSION]: 'data-testid Search section',
    },
    itemsV2: {
      [MIN_GRAFANA_VERSION]: 'data-testid Search items',
    },
    cards: {
      [MIN_GRAFANA_VERSION]: 'data-testid Search cards',
    },
    collapseFolder: {
      [MIN_GRAFANA_VERSION]: (sectionId: string) => `data-testid Collapse folder ${sectionId}`,
    },
    expandFolder: {
      [MIN_GRAFANA_VERSION]: (sectionId: string) => `data-testid Expand folder ${sectionId}`,
    },
    dashboardItem: {
      [MIN_GRAFANA_VERSION]: (item: string) => `data-testid Dashboard search item ${item}`,
    },
    dashboardCard: {
      [MIN_GRAFANA_VERSION]: (item: string) => `data-testid Search card ${item}`,
    },
    folderHeader: {
      '9.3.0': (folderName: string) => `data-testid Folder header ${folderName}`,
    },
    folderContent: {
      '9.3.0': (folderName: string) => `data-testid Folder content ${folderName}`,
    },
    dashboardItems: {
      [MIN_GRAFANA_VERSION]: 'data-testid Dashboard search item',
    },
  },
  DashboardLinks: {
    container: {
      [MIN_GRAFANA_VERSION]: 'data-testid Dashboard link container',
    },
    dropDown: {
      [MIN_GRAFANA_VERSION]: 'data-testid Dashboard link dropdown',
    },
    link: {
      [MIN_GRAFANA_VERSION]: 'data-testid Dashboard link',
    },
  },
  LoadingIndicator: {
    icon: {
      '10.4.0': 'data-testid Loading indicator',
      [MIN_GRAFANA_VERSION]: 'Loading indicator',
    },
  },
  CallToActionCard: {
    buttonV2: {
      [MIN_GRAFANA_VERSION]: (name: string) => `data-testid Call to action button ${name}`,
    },
  },
  DataLinksContextMenu: {
    singleLink: {
      '10.3.0': 'data-testid Data link',
      [MIN_GRAFANA_VERSION]: 'Data link',
    },
  },
  DataLinksActionsTooltip: {
    tooltipWrapper: {
      '12.1.0': 'data-testid Data links actions tooltip wrapper',
    },
  },
  CodeEditor: {
    container: {
      '10.2.3': 'data-testid Code editor container',
      [MIN_GRAFANA_VERSION]: 'Code editor container',
    },
  },
  ReactMonacoEditor: {
    editorLazy: {
      '11.1.0': 'data-testid ReactMonacoEditor editorLazy',
    },
  },
  DashboardImportPage: {
    textarea: {
      [MIN_GRAFANA_VERSION]: 'data-testid-import-dashboard-textarea',
    },
    submit: {
      [MIN_GRAFANA_VERSION]: 'data-testid-load-dashboard',
    },
  },
  ImportDashboardForm: {
    name: {
      [MIN_GRAFANA_VERSION]: 'data-testid-import-dashboard-title',
    },
    submit: {
      [MIN_GRAFANA_VERSION]: 'data-testid-import-dashboard-submit',
    },
  },
  PanelAlertTabContent: {
    content: {
      '10.2.3': 'data-testid Unified alert editor tab content',
      [MIN_GRAFANA_VERSION]: 'Unified alert editor tab content',
    },
  },
  VisualizationPreview: {
    card: {
      [MIN_GRAFANA_VERSION]: (name: string) => `data-testid suggestion-${name}`,
    },
  },
  ColorSwatch: {
    name: {
      [MIN_GRAFANA_VERSION]: 'data-testid-colorswatch',
    },
  },
  DashboardRow: {
    title: {
      [MIN_GRAFANA_VERSION]: (title: string) => `data-testid dashboard-row-title-${title}`,
    },
  },
  UserProfile: {
    profileSaveButton: {
      [MIN_GRAFANA_VERSION]: 'data-testid-user-profile-save',
    },
    preferencesSaveButton: {
      [MIN_GRAFANA_VERSION]: 'data-testid-shared-prefs-save',
    },
    orgsTable: {
      [MIN_GRAFANA_VERSION]: 'data-testid-user-orgs-table',
    },
    sessionsTable: {
      [MIN_GRAFANA_VERSION]: 'data-testid-user-sessions-table',
    },
    extensionPointTabs: {
      '10.2.3': 'data-testid-extension-point-tabs',
    },
    extensionPointTab: {
      '10.2.3': (tabId: string) => `data-testid-extension-point-tab-${tabId}`,
    },
  },
  FileUpload: {
    inputField: {
      '9.0.0': 'data-testid-file-upload-input-field',
    },
    fileNameSpan: {
      '9.0.0': 'data-testid-file-upload-file-name',
    },
  },
  DebugOverlay: {
    wrapper: {
      '9.2.0': 'debug-overlay',
    },
  },
  OrgRolePicker: {
    input: {
      '9.5.0': 'Role',
    },
  },
  AnalyticsToolbarButton: {
    button: {
      '9.5.0': 'Dashboard insights',
    },
  },
  Variables: {
    variableOption: {
      '9.5.0': 'data-testid variable-option',
    },
    variableLinkWrapper: {
      '11.1.1': 'data-testid variable-link-wrapper',
    },
  },
  Annotations: {
    annotationsTypeInput: {
      '11.1.0': 'data-testid annotations-type-input',
      [MIN_GRAFANA_VERSION]: 'annotations-type-input',
    },
    annotationsChoosePanelInput: {
      '11.1.0': 'data-testid choose-panels-input',
      [MIN_GRAFANA_VERSION]: 'choose-panels-input',
    },
    editor: {
      testButton: {
        '11.0.0': 'data-testid annotations-test-button',
      },
      resultContainer: {
        '11.0.0': 'data-testid annotations-query-result-container',
      },
    },
  },
  Tooltip: {
    container: {
      '10.2.0': 'data-testid tooltip',
    },
  },
  ReturnToPrevious: {
    buttonGroup: {
      '11.0.0': 'data-testid dismissable button group',
    },
    backButton: {
      '11.0.0': 'data-testid back',
    },
    dismissButton: {
      '11.0.0': 'data-testid dismiss',
    },
  },
  SQLQueryEditor: {
    selectColumn: {
      '11.0.0': 'data-testid select-column',
    },
    selectColumnInput: { '11.0.0': 'data-testid select-column-input' },
    selectFunctionParameter: { '11.0.0': (name: string) => `data-testid select-function-parameter-${name}` },
    selectAggregation: {
      '11.0.0': 'data-testid select-aggregation',
    },
    selectAggregationInput: { '11.0.0': 'data-testid select-aggregation-input' },
    selectAlias: {
      '11.0.0': 'data-testid select-alias',
    },
    selectAliasInput: { '11.0.0': 'data-testid select-alias-input' },
    selectInputParameter: { '11.0.0': 'data-testid select-input-parameter' },
    filterConjunction: {
      '11.0.0': 'data-testid filter-conjunction',
    },
    filterField: {
      '11.0.0': 'data-testid filter-field',
    },
    filterOperator: {
      '11.0.0': 'data-testid filter-operator',
    },
    headerTableSelector: {
      '11.0.0': 'data-testid header-table-selector',
    },
    headerFilterSwitch: {
      '11.0.0': 'data-testid header-filter-switch',
    },
    headerGroupSwitch: {
      '11.0.0': 'data-testid header-group-switch',
    },
    headerOrderSwitch: {
      '11.0.0': 'data-testid header-order-switch',
    },
    headerPreviewSwitch: {
      '11.0.0': 'data-testid header-preview-switch',
    },
  },
  EntityNotFound: {
    container: {
      '11.2.0': 'data-testid entity-not-found',
    },
  },
  Portal: {
    container: {
      '11.5.0': 'data-testid portal-container',
    },
  },
  ExportImage: {
    formatOptions: {
      container: {
        ['12.1.0']: 'data-testid export-image-format-options',
      },
      png: {
        ['12.1.0']: 'data-testid export-image-format-png',
      },
      jpg: {
        ['12.1.0']: 'data-testid export-image-format-jpg',
      },
    },
    rendererAlert: {
      container: {
        ['12.1.0']: 'data-testid export-image-renderer-alert',
      },
      title: {
        ['12.1.0']: 'data-testid export-image-renderer-alert-title',
      },
      description: {
        ['12.1.0']: 'data-testid export-image-renderer-alert-description',
      },
    },
    buttons: {
      generate: {
        ['12.1.0']: 'data-testid export-image-generate-button',
      },
      download: {
        ['12.1.0']: 'data-testid export-image-download-button',
      },
      cancel: {
        ['12.1.0']: 'data-testid export-image-cancel-button',
      },
    },
    preview: {
      container: {
        ['12.1.0']: 'data-testid export-image-preview-container',
      },
      loading: {
        ['12.1.0']: 'data-testid export-image-preview-loading',
      },
      image: {
        ['12.1.0']: 'data-testid export-image-preview',
      },
      error: {
        container: {
          ['12.1.0']: 'data-testid export-image-error',
        },
        title: {
          ['12.1.0']: 'data-testid export-image-error-title',
        },
        message: {
          ['12.1.0']: 'data-testid export-image-error-message',
        },
      },
    },
  },
} satisfies VersionedSelectorGroup;

export type VersionedComponents = typeof versionedComponents;
