export const versionedComponents = {
  TimePicker: {
    openButton: {
      '8.1.0': 'data-testid TimePicker Open Button',
      '7.5.0': 'TimePicker open button',
    },
    fromField: {
      '10.2.3': 'data-testid Time Range from field',
      '7.5.0': 'Time Range from field',
    },
    toField: {
      '10.2.3': 'data-testid Time Range to field',
      '7.5.0': 'Time Range to field',
    },
    applyTimeRange: {
      '8.1.0': 'data-testid TimePicker submit button',
      '7.5.0': 'TimePicker submit button',
    },
    absoluteTimeRangeTitle: {
      '7.5.0': 'data-testid-absolute-time-range-narrow',
    },
  },
  Menu: {
    MenuComponent: {
      '7.5.0': (title: string) => `${title} menu`,
    },
    MenuGroup: {
      '7.5.0': (title: string) => `${title} menu group`,
    },
    MenuItem: { '7.5.0': (title: string) => `${title} menu item` },
    SubMenu: {
      container: {
        '10.3.0': 'data-testid SubMenu container',
        '7.5.0': 'SubMenu',
      },
      icon: {
        '10.3.0': 'data-testid SubMenu icon',
        '7.5.0': 'SubMenu icon',
      },
    },
  },
  Panels: {
    Panel: {
      title: {
        '8.1.2': (title: string) => `data-testid Panel header ${title}`,
        '7.5.0': (title: string) => `Panel header ${title}`,
      },
      headerCornerInfo: {
        '7.5.0': (mode: string) => `Panel header ${mode}`,
      },
      status: {
        ['10.2.0']: (status: string) => `data-testid Panel status ${status}`,
        '7.5.0': (_: string) => 'Panel status',
      },
      toggleTableViewPanel: {
        '10.4.0': (title: string) => `data-testid Panel header ${title}`,
        '7.5.0': (_: string) => 'data-testid Panel',
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
          '7.5.0': 'table header',
        },
        footer: {
          '7.5.0': 'table-footer',
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
      '7.5.0': (name: string) => `VizLegend series ${name}`,
    },
  },
  Drawer: {
    General: {
      title: {
        '7.5.0': (title: string) => `Drawer title ${title}`,
      },
    },
  },
  PanelEditor: {
    General: {
      content: {
        '11.1.0': 'data-testid Panel editor content',
        '7.5.0': 'Panel editor content',
      },
    },
    applyButton: {
      '9.2.0': 'data-testid Apply changes and go back to dashboard',
      '7.5.0': 'Apply changes and go back to dashboard',
    },
    toggleVizPicker: {
      '10.0.0': 'data-testid toggle-viz-picker',
      '7.5.0': 'toggle-viz-picker',
    },
    OptionsPane: {
      content: {
        '11.1.0': 'data-testid Panel editor option pane content',
        '7.5.0': 'Panel editor option pane content',
      },
      fieldLabel: {
        '7.5.0': (type: string) => `${type} field property editor`,
      },
      fieldInput: {
        '11.0.0': (title: string) => `data-testid Panel editor option pane field input ${title}`,
      },
    },
  },
  RefreshPicker: {
    runButtonV2: {
      '8.3.0': 'data-testid RefreshPicker run button',
      '7.5.0': 'RefreshPicker run button',
    },
  },
  QueryTab: {
    addQuery: {
      '10.2.0': 'data-testid query-tab-add-query',
      '7.5.0': 'Query editor add query button',
    },
    addExpression: {
      '11.0.0': 'data-testid query-tab-add-expression',
      '9.5.2': 'query-tab-add-expression',
    },
  },
  QueryEditorRows: {
    rows: {
      '7.5.0': 'Query editor row',
    },
  },
  QueryEditorRow: {
    title: {
      '7.5.0': (refId: string) => `Query editor row title ${refId}`,
    },
    actionButton: {
      '10.4.0': (title: string) => `data-testid ${title}`,
      '7.5.0': (title: string) => `${title}`,
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
      '7.5.0': (severity: string) => `Alert ${severity}`,
    },
  },
  PageToolbar: {
    item: {
      '7.5.0': (tooltip: string) => `${tooltip}`,
    },
    showMoreItems: {
      '7.5.0': 'Show more items',
    },
    itemButton: {
      //did not exist prior to 9.5.0
      '9.5.0': (title: string) => `data-testid ${title}`,
    },
    itemButtonTitle: {
      '10.1.0': 'Add button',
      '7.5.0': 'Add panel button',
    },
  },
  QueryEditorToolbarItem: {
    button: {
      '7.5.0': (title: string) => `QueryEditor toolbar item button ${title}`,
    },
  },
  OptionsGroup: {
    group: {
      '11.1.0': (title?: string) => (title ? `data-testid Options group ${title}` : 'data-testid Options group'),
      '7.5.0': (title?: string) => (title ? `Options group ${title}` : 'Options group'),
    },
    toggle: {
      '11.1.0': (title?: string) =>
        title ? `data-testid Options group ${title} toggle` : 'data-testid Options group toggle',
      '7.5.0': (title?: string) => (title ? `Options group ${title} toggle` : 'Options group toggle'),
    },
    groupTitle: {
      '7.5.0': 'Panel options',
    },
  },
  PluginVisualization: {
    item: {
      '7.5.0': (title: string) => `Plugin visualization item ${title}`,
    },
  },
  Select: {
    option: {
      '11.1.0': 'data-testid Select option',
      '7.5.0': 'Select option',
    },
    input: {
      '8.3.0': () => 'input[id*="time-options-input"]',
      '7.5.0': () => 'input[id*="react-select-"]',
    },
    singleValue: {
      '7.5.0': () => 'div[class*="-singleValue"]',
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
      '7.5.0': 'Folder picker select container',
    },
    changeTimeSettingsButton: {
      '11.0.0': 'data-testid Time zone picker Change time settings button',
    },
  },
  CodeEditor: {
    container: {
      '10.2.3': 'data-testid Code editor container',
      '7.5.0': 'Code editor container',
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
      '7.5.0': 'Query field',
    },
  },
};
