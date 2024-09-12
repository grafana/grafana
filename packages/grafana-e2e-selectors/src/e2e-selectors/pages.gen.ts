import { MIN_GRAFANA_VERSION } from './constants';
export const versionedPages = {
    Home: {
        url: '/',
    },
    Alerting: {
        AddAlertRule: {
            url: '/alerting/new',
        },
        EditAlertRule: {
            url: (alertRuleUid: string) => `alerting/${alertRuleUid}/edit`,
        },
    },
    DataSource: {
        saveAndTest: 'data-testid Data source settings page Save and Test button',
    },
    EditDataSource: {
        url: (dataSourceUid: string) => `/connections/datasources/edit/${dataSourceUid}`,
    },
    AddDashboard: {
        url: '/dashboard/new',
        itemButton: (title: string) => `data-testid ${title}`,
        addNewPanel: 'Add new panel',
        itemButtonAddViz: 'Add new visualization menu item',
        Settings: {
            Annotations: {
                List: {
                    url: '/dashboard/new?orgId=1&editview=annotations',
                },
                Edit: {
                    url: (annotationIndex: string) => `/dashboard/new?editview=annotations&editIndex=${annotationIndex}`,
                },
            },
            Variables: {
                List: {
                    url: '/dashboard/new?orgId=1&editview=templating',
                },
                Edit: {
                    url: (annotationIndex: string) => `/dashboard/new?orgId=1&editview=templating&editIndex=${annotationIndex}`,
                },
            },
        },
    },
    Dashboard: {
        url: (uid: string) => `/d/${uid}`,
        Settings: {
            Actions: {
                close: 'data-testid dashboard-settings-close',
            },
            Annotations: {
                Edit: {
                    url: (dashboardUid: string, annotationIndex: string) => `/d/${dashboardUid}?editview=annotations&editIndex=${annotationIndex}`,
                },
                List: {
                    url: (dashboardUid: string) => `/d/${dashboardUid}?editview=annotations`,
                    addAnnotationCTA: 'Call to action button Add annotation query',
                    addAnnotationCTAV2: 'data-testid Call to action button Add annotation query',
                },
            },
            Variables: {
                List: {
                    url: (dashboardUid: string) => `/d/${dashboardUid}?editview=templating`,
                    newButton: 'Variable editor New variable button',
                    table: 'Variable editor Table',
                    addVariableCTAV2: (name: string) => `data-testid Call to action button ${name}`,
                    addVariableCTAV2Item: 'Add variable',
                },
                Edit: {
                    url: (dashboardUid: string, editIndex: string) => `/d/${dashboardUid}?editview=templating&editIndex=${editIndex}`,
                    General: {
                        generalTypeSelectV2: 'data-testid Variable editor Form Type select',
                        previewOfValuesOption: 'data-testid Variable editor Preview of Values option',
                        submitButton: 'data-testid Variable editor Run Query button',
                        selectionOptionsIncludeAllSwitch: 'Variable editor Form IncludeAll switch',
                        generalNameInputV2: 'data-testid Variable editor Form Name field',
                        applyButton: 'data-testid Variable editor Apply button',
                    },
                },
            },
        },
        SubMenu: {
            submenuItemLabels: (item: string) => `data-testid Dashboard template variables submenu Label ${item}`,
            submenuItemValueDropDownValueLinkTexts: (item: string) => `data-testid Dashboard template variables Variable Value DropDown value link text ${item}`,
            submenuItemValueDropDownDropDown: 'Variable options',
            submenuItemValueDropDownOptionTexts: (item: string) => `data-testid Dashboard template variables Variable Value DropDown option text ${item}`,
        },
        SaveDashboardAsModal: {
            newName: 'Save dashboard title field',
            save: 'Save dashboard button',
        },
    },
    Explore: {
        url: '/explore',
    },
    Plugin: {
        url: (pluginId: string) => `/plugins/${pluginId}`,
    },
};
