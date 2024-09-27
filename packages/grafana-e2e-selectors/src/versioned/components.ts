import { MIN_GRAFANA_VERSION } from './constants';

export const versionedComponents = {
  TimePicker: {
    openButton: {
      '8.1.0': 'data-testid TimePicker Open Button',
      [MIN_GRAFANA_VERSION]: 'TimePicker open button',
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
      '8.1.0': 'data-testid TimePicker submit button',
      [MIN_GRAFANA_VERSION]: 'TimePicker submit button',
    },
    absoluteTimeRangeTitle: {
      [MIN_GRAFANA_VERSION]: 'data-testid-absolute-time-range-narrow',
    },
  },
  Menu: {
    MenuComponent: {
      [MIN_GRAFANA_VERSION]: (title: string) => `${title} menu`,
    },
    MenuGroup: {
      [MIN_GRAFANA_VERSION]: (title: string) => `${title} menu group`,
    },
    MenuItem: { [MIN_GRAFANA_VERSION]: (title: string) => `${title} menu item` },
    SubMenu: {
      container: {
        '10.3.0': 'data-testid SubMenu container',
        [MIN_GRAFANA_VERSION]: 'SubMenu',
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
        '8.1.2': (title: string) => `data-testid Panel header ${title}`,
        [MIN_GRAFANA_VERSION]: (title: string) => `Panel header ${title}`,
      },
      headerCornerInfo: {
        [MIN_GRAFANA_VERSION]: (mode: string) => `Panel header ${mode}`,
      },
      status: {
        ['10.2.0']: (status: string) => `data-testid Panel status ${status}`,
        [MIN_GRAFANA_VERSION]: (_: string) => 'Panel status',
      },
      toggleTableViewPanel: {
        '10.4.0': (title: string) => `data-testid Panel header ${title}`,
        [MIN_GRAFANA_VERSION]: (_: string) => 'data-testid Panel',
      },
      PanelDataErrorMessage: {
        '10.4.0': 'data-testid Panel data error message',
      },
      menuItems: { '9.5.0': (item: string) => `data-testid Panel menu item ${item}` },
      menu: { '9.5.0': (item: string) => `data-testid Panel menu ${item}` },
    },
    Visualization: {
      Table: {
        header: {
          [MIN_GRAFANA_VERSION]: 'table header',
        },
        footer: {
          [MIN_GRAFANA_VERSION]: 'table-footer',
        },
        body: {
          // did not exist prior to 10.2.0
          '10.2.0': 'data-testid table body',
        },
      },
    },
  },
  VizLegend: {
    seriesName: {
      [MIN_GRAFANA_VERSION]: (name: string) => `VizLegend series ${name}`,
    },
  },
  Drawer: {
    General: {
      title: {
        [MIN_GRAFANA_VERSION]: (title: string) => `Drawer title ${title}`,
      },
    },
  },
  PanelEditor: {
    General: {
      content: {
        '11.1.0': 'data-testid Panel editor content',
        [MIN_GRAFANA_VERSION]: 'Panel editor content',
      },
    },
    applyButton: {
      '9.2.0': 'data-testid Apply changes and go back to dashboard',
      [MIN_GRAFANA_VERSION]: 'Apply changes and go back to dashboard',
    },
    toggleVizPicker: {
      '10.0.0': 'data-testid toggle-viz-picker',
      [MIN_GRAFANA_VERSION]: 'toggle-viz-picker',
    },
    OptionsPane: {
      content: {
        '11.1.0': 'data-testid Panel editor option pane content',
        [MIN_GRAFANA_VERSION]: 'Panel editor option pane content',
      },
      fieldLabel: {
        [MIN_GRAFANA_VERSION]: (type: string) => `${type} field property editor`,
      },
      fieldInput: {
        '11.0.0': (title: string) => `data-testid Panel editor option pane field input ${title}`,
      },
    },
  },
  RefreshPicker: {
    runButtonV2: {
      ['8.3.0']: 'data-testid RefreshPicker run button',
      [MIN_GRAFANA_VERSION]: 'RefreshPicker run button',
    },
  },
  QueryTab: {
    addQuery: {
      '10.2.0': 'data-testid query-tab-add-query',
      [MIN_GRAFANA_VERSION]: 'Query editor add query button',
    },
    addExpression: {
      '11.0.0': 'data-testid query-tab-add-expression',
      '9.5.2': 'query-tab-add-expression',
    },
  },
  QueryEditorRows: {
    rows: {
      [MIN_GRAFANA_VERSION]: 'Query editor row',
    },
  },
  QueryEditorRow: {
    title: {
      [MIN_GRAFANA_VERSION]: (refId: string) => `Query editor row title ${refId}`,
    },
    actionButton: {
      '10.4.0': (title: string) => `data-testid ${title}`,
      [MIN_GRAFANA_VERSION]: (title: string) => `${title}`,
    },
  },
  AlertRules: {
    previewButton: { '11.1.0': 'data-testid alert-rule preview-button' },
    ruleNameField: { '11.1.0': 'data-testid alert-rule name-field' },
    newFolderButton: { '11.1.0': 'data-testid alert-rule new-folder-button' },
    newFolderNameField: { '11.1.0': 'data-testid alert-rule name-folder-name-field' },
    newFolderNameCreateButton: { '11.1.0': 'data-testid alert-rule name-folder-name-create-button' },
    newEvaluationGroupButton: { '11.1.0': 'data-testid alert-rule new-evaluation-group-button' },
    newEvaluationGroupName: { '11.1.0': 'data-testid alert-rule new-evaluation-group-name' },
    newEvaluationGroupInterval: { '11.1.0': 'data-testid alert-rule new-evaluation-group-interval' },
    newEvaluationGroupCreate: { '11.1.0': 'data-testid alert-rule new-evaluation-group-create-button' },
  },
  Alert: {
    alertV2: {
      '8.3.0': (severity: string) => `data-testid Alert ${severity}`,
      [MIN_GRAFANA_VERSION]: (severity: string) => `Alert ${severity}`,
    },
  },
  PageToolbar: {
    item: {
      [MIN_GRAFANA_VERSION]: (tooltip: string) => `${tooltip}`,
    },
    showMoreItems: {
      [MIN_GRAFANA_VERSION]: 'Show more items',
    },
    itemButton: {
      //did not exist prior to 9.5.0
      ['9.5.0']: (title: string) => `data-testid ${title}`,
    },
    itemButtonTitle: {
      '10.1.0': 'Add button',
      [MIN_GRAFANA_VERSION]: 'Add panel button',
    },
  },
  QueryEditorToolbarItem: {
    button: {
      [MIN_GRAFANA_VERSION]: (title: string) => `QueryEditor toolbar item button ${title}`,
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
    groupTitle: {
      [MIN_GRAFANA_VERSION]: 'Panel options',
    },
  },
  PluginVisualization: {
    item: {
      [MIN_GRAFANA_VERSION]: (title: string) => `Plugin visualization item ${title}`,
    },
  },
  Select: {
    option: {
      '11.1.0': 'data-testid Select option',
      [MIN_GRAFANA_VERSION]: 'Select option',
    },
    input: {
      '8.3.0': () => 'input[id*="time-options-input"]',
      [MIN_GRAFANA_VERSION]: () => 'input[id*="react-select-"]',
    },
    singleValue: {
      [MIN_GRAFANA_VERSION]: () => 'div[class*="-singleValue"]',
    },
  },
  DataSourcePicker: {
    container: {
      '10.0.0': 'data-testid Data source picker select container',
      // did not exist prior to 8.3.0
      '8.3.0': 'Data source picker select container',
    },
  },
  TimeZonePicker: {
    containerV2: {
      '8.3.0': 'data-testid Time zone picker select container',
      [MIN_GRAFANA_VERSION]: 'Folder picker select container',
    },
    changeTimeSettingsButton: {
      '11.0.0': 'data-testid Time zone picker Change time settings button',
    },
  },
  CodeEditor: {
    container: {
      '10.2.3': 'data-testid Code editor container',
      [MIN_GRAFANA_VERSION]: 'Code editor container',
    },
  },
  Annotations: {
    editor: {
      testButton: {
        '11.0.0': 'data-testid annotations-test-button',
      },
      resultContainer: {
        '11.0.0': 'data-testid annotations-query-result-container',
      },
    },
  },
  QueryField: {
    container: {
      '10.3.0': 'data-testid Query field',
      [MIN_GRAFANA_VERSION]: 'Query field',
    },
  },
};
