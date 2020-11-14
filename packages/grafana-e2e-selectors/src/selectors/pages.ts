export const Pages = {
  Login: {
    url: '/login',
    username: 'Username input field',
    password: 'Password input field',
    submit: 'Login button',
    skip: 'Skip change password button',
  },
  Home: {
    url: '/',
  },
  DataSource: {
    name: 'Data source settings page name input field',
    delete: 'Data source settings page Delete button',
    saveAndTest: 'Data source settings page Save and Test button',
    alert: 'Data source settings page Alert',
    alertMessage: 'Data source settings page Alert message',
  },
  DataSources: {
    url: '/datasources',
    dataSources: (dataSourceName: string) => `Data source list item ${dataSourceName}`,
  },
  AddDataSource: {
    url: '/datasources/new',
    dataSourcePlugins: (pluginName: string) => `Data source plugin item ${pluginName}`,
  },
  ConfirmModal: {
    delete: 'Confirm Modal Danger Button',
  },
  AddDashboard: {
    url: '/dashboard/new',
    addNewPanel: 'Add new panel',
  },
  Dashboard: {
    url: (uid: string) => `/d/${uid}`,
    Toolbar: {
      toolbarItems: (button: string) => `Dashboard navigation bar button ${button}`,
      navBar: () => '.navbar',
    },
    SubMenu: {
      submenuItem: 'Dashboard template variables submenu item',
      submenuItemLabels: (item: string) => `Dashboard template variables submenu Label ${item}`,
      submenuItemValueDropDownValueLinkTexts: (item: string) =>
        `Dashboard template variables Variable Value DropDown value link text ${item}`,
      submenuItemValueDropDownDropDown: 'Dashboard template variables Variable Value DropDown DropDown',
      submenuItemValueDropDownOptionTexts: (item: string) =>
        `Dashboard template variables Variable Value DropDown option text ${item}`,
    },
    Settings: {
      General: {
        deleteDashBoard: 'Dashboard settings page delete dashboard button',
        sectionItems: (item: string) => `Dashboard settings section item ${item}`,
        saveDashBoard: 'Dashboard settings aside actions Save button',
        saveAsDashBoard: 'Dashboard settings aside actions Save As button',
        timezone: 'Time zone picker select container',
        title: 'Dashboard settings page title',
      },
      Annotations: {
        List: {
          addAnnotationCTA: 'Call to action button Add Annotation Query',
        },
      },
      Variables: {
        List: {
          addVariableCTA: 'Call to action button Add variable',
          newButton: 'Variable editor New variable button',
          table: 'Variable editor Table',
          tableRowNameFields: (variableName: string) => `Variable editor Table Name field ${variableName}`,
          tableRowDefinitionFields: (variableName: string) => `Variable editor Table Definition field ${variableName}`,
          tableRowArrowUpButtons: (variableName: string) => `Variable editor Table ArrowUp button ${variableName}`,
          tableRowArrowDownButtons: (variableName: string) => `Variable editor Table ArrowDown button ${variableName}`,
          tableRowDuplicateButtons: (variableName: string) => `Variable editor Table Duplicate button ${variableName}`,
          tableRowRemoveButtons: (variableName: string) => `Variable editor Table Remove button ${variableName}`,
        },
        Edit: {
          General: {
            headerLink: 'Variable editor Header link',
            modeLabelNew: 'Variable editor Header mode New',
            modeLabelEdit: 'Variable editor Header mode Edit',
            generalNameInput: 'Variable editor Form Name field',
            generalTypeSelect: 'Variable editor Form Type select',
            generalLabelInput: 'Variable editor Form Label field',
            generalHideSelect: 'Variable editor Form Hide select',
            selectionOptionsMultiSwitch: 'Variable editor Form Multi switch',
            selectionOptionsIncludeAllSwitch: 'Variable editor Form IncludeAll switch',
            selectionOptionsCustomAllInput: 'Variable editor Form IncludeAll field',
            previewOfValuesOption: 'Variable editor Preview of Values option',
            submitButton: 'Variable editor Submit button',
          },
          QueryVariable: {
            queryOptionsDataSourceSelect: 'Variable editor Form Query DataSource select',
            queryOptionsRefreshSelect: 'Variable editor Form Query Refresh select',
            queryOptionsRegExInput: 'Variable editor Form Query RegEx field',
            queryOptionsSortSelect: 'Variable editor Form Query Sort select',
            queryOptionsQueryInput: 'Variable editor Form Default Variable Query Editor textarea',
            valueGroupsTagsEnabledSwitch: 'Variable editor Form Query UseTags switch',
            valueGroupsTagsTagsQueryInput: 'Variable editor Form Query TagsQuery field',
            valueGroupsTagsTagsValuesQueryInput: 'Variable editor Form Query TagsValuesQuery field',
          },
          ConstantVariable: {
            constantOptionsQueryInput: 'Variable editor Form Constant Query field',
          },
        },
      },
    },
  },
  Dashboards: {
    url: '/dashboards',
    dashboards: (title: string) => `Dashboard search item ${title}`,
  },
  SaveDashboardAsModal: {
    newName: 'Save dashboard title field',
    save: 'Save dashboard button',
  },
  SaveDashboardModal: {
    save: 'Dashboard settings Save Dashboard Modal Save button',
    saveVariables: 'Dashboard settings Save Dashboard Modal Save variables checkbox',
    saveTimerange: 'Dashboard settings Save Dashboard Modal Save timerange checkbox',
  },
  SharePanelModal: {
    linkToRenderedImage: 'Link to rendered image',
  },
  Explore: {
    url: '/explore',
    General: {
      container: 'Explore',
      graph: 'Explore Graph',
      runButton: 'Run button',
      table: 'Explore Table',
    },
    Toolbar: {
      navBar: () => '.explore-toolbar',
    },
  },
  SoloPanel: {
    url: (page: string) => `/d-solo/${page}`,
  },
  PluginsList: {
    page: 'Plugins list page',
    list: 'Plugins list',
    listItem: 'Plugins list item',
    signatureErrorNotice: 'Unsigned plugins notice',
  },
  PluginPage: {
    page: 'Plugin page',
    signatureInfo: 'Plugin signature info',
  },
};
