import { MIN_GRAFANA_VERSION } from './constants';

export const versionedPages = {
  Home: {
    url: {
      [MIN_GRAFANA_VERSION]: '/',
    },
  },
  Alerting: {
    AddAlertRule: {
      url: {
        ['10.1.0']: '/alerting/new/alerting',
        [MIN_GRAFANA_VERSION]: '/alerting/new',
      },
    },
    EditAlertRule: {
      url: {
        [MIN_GRAFANA_VERSION]: (alertRuleUid: string) => `alerting/${alertRuleUid}/edit`,
      },
    },
  },
  DataSource: {
    saveAndTest: {
      '10.0.0': 'data-testid Data source settings page Save and Test button',
      [MIN_GRAFANA_VERSION]: 'Data source settings page Save and Test button',
    },
  },
  EditDataSource: {
    url: {
      '10.2.0': (dataSourceUid: string) => `/connections/datasources/edit/${dataSourceUid}`,
      [MIN_GRAFANA_VERSION]: (dataSourceUid: string) => `/datasources/edit/${dataSourceUid}`,
    },
  },
  AddDashboard: {
    url: {
      [MIN_GRAFANA_VERSION]: '/dashboard/new',
    },
    itemButton: {
      //did not exist prior to 9.5.0
      '9.5.0': (title: string) => `data-testid ${title}`,
    },
    addNewPanel: {
      [MIN_GRAFANA_VERSION]: 'Add new panel',
    },
    itemButtonAddViz: {
      [MIN_GRAFANA_VERSION]: 'Add new visualization menu item',
    },
    Settings: {
      Annotations: {
        List: {
          url: {
            [MIN_GRAFANA_VERSION]: '/dashboard/new?orgId=1&editview=annotations',
          },
        },
        Edit: {
          url: {
            [MIN_GRAFANA_VERSION]: (annotationIndex: string) =>
              `/dashboard/new?editview=annotations&editIndex=${annotationIndex}`,
          },
        },
      },
      Variables: {
        List: {
          url: {
            [MIN_GRAFANA_VERSION]: '/dashboard/new?orgId=1&editview=templating',
          },
        },
        Edit: {
          url: {
            [MIN_GRAFANA_VERSION]: (annotationIndex: string) =>
              `/dashboard/new?orgId=1&editview=templating&editIndex=${annotationIndex}`,
          },
        },
      },
    },
  },
  Dashboard: {
    url: {
      [MIN_GRAFANA_VERSION]: (uid: string) => `/d/${uid}`,
    },
    Settings: {
      Actions: {
        close: {
          [MIN_GRAFANA_VERSION]: 'Go Back button',
          '9.5.0': 'data-testid dashboard-settings-close',
        },
      },
      Annotations: {
        Edit: {
          url: {
            [MIN_GRAFANA_VERSION]: (dashboardUid: string, annotationIndex: string) =>
              `/d/${dashboardUid}?editview=annotations&editIndex=${annotationIndex}`,
          },
        },
        List: {
          url: {
            [MIN_GRAFANA_VERSION]: (dashboardUid: string) => `/d/${dashboardUid}?editview=annotations`,
          },
          addAnnotationCTA: 'Call to action button Add annotation query',
          addAnnotationCTAV2: {
            //did not exist prior to 8.3.0
            '8.3.0': 'data-testid Call to action button Add annotation query',
          },
        },
      },
      Variables: {
        List: {
          url: {
            [MIN_GRAFANA_VERSION]: (dashboardUid: string) => `/d/${dashboardUid}?editview=templating`,
          },
          newButton: {
            [MIN_GRAFANA_VERSION]: 'Variable editor New variable button',
          },
          table: {
            [MIN_GRAFANA_VERSION]: 'Variable editor Table',
          },
          addVariableCTAV2: {
            [MIN_GRAFANA_VERSION]: (name: string) => `data-testid Call to action button ${name}`,
          },
          addVariableCTAV2Item: {
            [MIN_GRAFANA_VERSION]: 'Add variable',
          },
        },
        Edit: {
          url: {
            [MIN_GRAFANA_VERSION]: (dashboardUid: string, editIndex: string) =>
              `/d/${dashboardUid}?editview=templating&editIndex=${editIndex}`,
          },
          General: {
            generalTypeSelectV2: {
              '8.5.0': 'data-testid Variable editor Form Type select',
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Type select',
            },
            previewOfValuesOption: {
              '10.4.0': 'data-testid Variable editor Preview of Values option',
              [MIN_GRAFANA_VERSION]: 'Variable editor Preview of Values option',
            },
            submitButton: {
              '10.4.0': 'data-testid Variable editor Run Query button',
              [MIN_GRAFANA_VERSION]: 'Variable editor Submit button',
            },
            selectionOptionsIncludeAllSwitch: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form IncludeAll switch',
            },
            generalNameInputV2: {
              '8.5.0': 'data-testid Variable editor Form Name field',
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Name field',
            },
            applyButton: {
              '9.3.0': 'data-testid Variable editor Apply button',
            },
          },
        },
      },
    },
    SubMenu: {
      submenuItemLabels: {
        [MIN_GRAFANA_VERSION]: (item: string) => `data-testid Dashboard template variables submenu Label ${item}`,
      },
      submenuItemValueDropDownValueLinkTexts: {
        [MIN_GRAFANA_VERSION]: (item: string) =>
          `data-testid Dashboard template variables Variable Value DropDown value link text ${item}`,
      },
      submenuItemValueDropDownDropDown: { [MIN_GRAFANA_VERSION]: 'Variable options' },
      submenuItemValueDropDownOptionTexts: {
        [MIN_GRAFANA_VERSION]: (item: string) =>
          `data-testid Dashboard template variables Variable Value DropDown option text ${item}`,
      },
    },
    SaveDashboardAsModal: {
      newName: {
        [MIN_GRAFANA_VERSION]: 'Save dashboard title field',
      },
      save: {
        [MIN_GRAFANA_VERSION]: 'Save dashboard button',
      },
    },
  },
  Explore: {
    url: {
      [MIN_GRAFANA_VERSION]: '/explore',
    },
  },
  Plugin: {
    url: {
      [MIN_GRAFANA_VERSION]: (pluginId: string) => `/plugins/${pluginId}`,
    },
  },
};
