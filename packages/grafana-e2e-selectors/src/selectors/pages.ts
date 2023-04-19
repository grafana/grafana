import { Components } from './components';

/**
 * Selectors grouped/defined in Pages
 *
 * @alpha
 */
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
    readOnly: 'Data source settings page read only message',
    saveAndTest: 'Data source settings page Save and Test button',
    alert: 'Data source settings page Alert',
  },
  DataSources: {
    url: '/datasources',
    dataSources: (dataSourceName: string) => `Data source list item ${dataSourceName}`,
  },
  EditDataSource: {
    url: (dataSourceUid: string) => `/datasources/edit/${dataSourceUid}`,
    settings: 'Datasource settings page basic settings',
  },
  AddDataSource: {
    url: '/datasources/new',
    /** @deprecated Use dataSourcePluginsV2 */
    dataSourcePlugins: (pluginName: string) => `Data source plugin item ${pluginName}`,
    dataSourcePluginsV2: (pluginName: string) => `Add new data source ${pluginName}`,
  },
  ConfirmModal: {
    delete: 'Confirm Modal Danger Button',
  },
  AddDashboard: {
    url: '/dashboard/new',
    itemButton: (title: string) => `data-testid ${title}`,
    addNewPanel: 'Add new panel',
    addNewRow: 'Add new row',
    addNewPanelLibrary: 'Add new panel from panel library',
  },
  Dashboard: {
    url: (uid: string) => `/d/${uid}`,
    DashNav: {
      /**
       * @deprecated use navV2 from Grafana 8.3 instead
       */
      nav: 'Dashboard navigation',
      navV2: 'data-testid Dashboard navigation',
      publicDashboardTag: 'data-testid public dashboard tag',
    },
    SubMenu: {
      submenu: 'Dashboard submenu',
      submenuItem: 'data-testid template variable',
      submenuItemLabels: (item: string) => `data-testid Dashboard template variables submenu Label ${item}`,
      submenuItemValueDropDownValueLinkTexts: (item: string) =>
        `data-testid Dashboard template variables Variable Value DropDown value link text ${item}`,
      submenuItemValueDropDownDropDown: 'Variable options',
      submenuItemValueDropDownOptionTexts: (item: string) =>
        `data-testid Dashboard template variables Variable Value DropDown option text ${item}`,
      Annotations: {
        annotationsWrapper: 'data-testid annotation-wrapper',
        annotationLabel: (label: string) => `data-testid Dashboard annotations submenu Label ${label}`,
        annotationToggle: (label: string) => `data-testid Dashboard annotations submenu Toggle ${label}`,
      },
    },
    Settings: {
      Actions: {
        close: 'data-testid dashboard-settings-close',
      },
      General: {
        deleteDashBoard: 'Dashboard settings page delete dashboard button',
        sectionItems: (item: string) => `Dashboard settings section item ${item}`,
        saveDashBoard: 'Dashboard settings aside actions Save button',
        saveAsDashBoard: 'Dashboard settings aside actions Save As button',
        /**
         * @deprecated use components.TimeZonePicker.containerV2 from Grafana 8.3 instead
         */
        timezone: 'Time zone picker select container',
        title: 'Tab General',
      },
      Annotations: {
        List: {
          /**
           * @deprecated use addAnnotationCTAV2 from Grafana 8.3 instead
           */
          addAnnotationCTA: Components.CallToActionCard.button('Add annotation query'),
          addAnnotationCTAV2: Components.CallToActionCard.buttonV2('Add annotation query'),
        },
        Settings: {
          name: 'Annotations settings name input',
        },
        NewAnnotation: {
          panelFilterSelect: 'data-testid annotations-panel-filter',
          showInLabel: 'show-in-label',
          previewInDashboard: 'data-testid annotations-preview',
        },
      },
      Variables: {
        List: {
          /**
           * @deprecated use addVariableCTAV2 from Grafana 8.3 instead
           */
          addVariableCTA: Components.CallToActionCard.button('Add variable'),
          addVariableCTAV2: Components.CallToActionCard.buttonV2('Add variable'),
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
            /**
             * @deprecated
             */
            modeLabelEdit: 'Variable editor Header mode Edit',
            generalNameInput: 'Variable editor Form Name field',
            generalNameInputV2: 'data-testid Variable editor Form Name field',
            generalTypeSelect: 'Variable editor Form Type select',
            generalTypeSelectV2: 'data-testid Variable editor Form Type select',
            generalLabelInput: 'Variable editor Form Label field',
            generalLabelInputV2: 'data-testid Variable editor Form Label field',
            generalHideSelect: 'Variable editor Form Hide select',
            generalHideSelectV2: 'data-testid Variable editor Form Hide select',
            selectionOptionsMultiSwitch: 'Variable editor Form Multi switch',
            selectionOptionsIncludeAllSwitch: 'Variable editor Form IncludeAll switch',
            selectionOptionsCustomAllInput: 'Variable editor Form IncludeAll field',
            selectionOptionsCustomAllInputV2: 'data-testid Variable editor Form IncludeAll field',
            previewOfValuesOption: 'Variable editor Preview of Values option',
            submitButton: 'Variable editor Submit button',
            applyButton: 'data-testid Variable editor Apply button',
          },
          QueryVariable: {
            queryOptionsDataSourceSelect: Components.DataSourcePicker.container,
            queryOptionsRefreshSelect: 'Variable editor Form Query Refresh select',
            queryOptionsRefreshSelectV2: 'data-testid Variable editor Form Query Refresh select',
            queryOptionsRegExInput: 'Variable editor Form Query RegEx field',
            queryOptionsRegExInputV2: 'data-testid Variable editor Form Query RegEx field',
            queryOptionsSortSelect: 'Variable editor Form Query Sort select',
            queryOptionsSortSelectV2: 'data-testid Variable editor Form Query Sort select',
            queryOptionsQueryInput: 'Variable editor Form Default Variable Query Editor textarea',
            valueGroupsTagsEnabledSwitch: 'Variable editor Form Query UseTags switch',
            valueGroupsTagsTagsQueryInput: 'Variable editor Form Query TagsQuery field',
            valueGroupsTagsTagsValuesQueryInput: 'Variable editor Form Query TagsValuesQuery field',
          },
          ConstantVariable: {
            constantOptionsQueryInput: 'Variable editor Form Constant Query field',
            constantOptionsQueryInputV2: 'data-testid Variable editor Form Constant Query field',
          },
          DatasourceVariable: {
            datasourceSelect: 'data-testid datasource variable datasource type',
          },
          TextBoxVariable: {
            textBoxOptionsQueryInput: 'Variable editor Form TextBox Query field',
            textBoxOptionsQueryInputV2: 'data-testid Variable editor Form TextBox Query field',
          },
          CustomVariable: {
            customValueInput: 'data-testid custom-variable-input',
          },
          IntervalVariable: {
            intervalsValueInput: 'data-testid interval variable intervals input',
          },
        },
      },
    },
  },
  Dashboards: {
    url: '/dashboards',
    /**
     * @deprecated use components.Search.dashboardItem from Grafana 8.3 instead
     */
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
  ShareDashboardModal: {
    shareButton: 'Share dashboard or panel',
    PublicDashboard: {
      Tab: 'Tab Public dashboard',
      WillBePublicCheckbox: 'data-testid public dashboard will be public checkbox',
      LimitedDSCheckbox: 'data-testid public dashboard limited datasources checkbox',
      CostIncreaseCheckbox: 'data-testid public dashboard cost may increase checkbox',
      PauseSwitch: 'data-testid public dashboard pause switch',
      EnableAnnotationsSwitch: 'data-testid public dashboard on off switch for annotations',
      CreateButton: 'data-testid public dashboard create button',
      DeleteButton: 'data-testid public dashboard delete button',
      CopyUrlInput: 'data-testid public dashboard copy url input',
      CopyUrlButton: 'data-testid public dashboard copy url button',
      TemplateVariablesWarningAlert: 'data-testid public dashboard disabled template variables alert',
      UnsupportedDataSourcesWarningAlert: 'data-testid public dashboard unsupported data sources alert',
      NoUpsertPermissionsWarningAlert: 'data-testid public dashboard no upsert permissions alert',
      EnableTimeRangeSwitch: 'data-testid public dashboard on off switch for time range',
      EmailSharingConfiguration: {
        Container: 'data-testid email sharing config container',
        ShareType: 'data-testid public dashboard share type',
        EmailSharingInput: 'data-testid public dashboard email sharing input',
        EmailSharingInviteButton: 'data-testid public dashboard email sharing invite button',
        EmailSharingList: 'data-testid public dashboard email sharing list',
        DeleteEmail: 'data-testid public dashboard delete email button',
        ReshareLink: 'data-testid public dashboard reshare link button',
      },
    },
  },
  PublicDashboard: {
    page: 'public-dashboard-page',
    NotAvailable: {
      container: 'public-dashboard-not-available',
      title: 'public-dashboard-title',
      pausedDescription: 'public-dashboard-paused-description',
    },
  },
  RequestViewAccess: {
    form: 'request-view-access-form',
    recipientInput: 'request-view-access-recipient-input',
    submitButton: 'request-view-access-submit-button',
  },
  Explore: {
    url: '/explore',
    General: {
      container: 'data-testid Explore',
      graph: 'Explore Graph',
      table: 'Explore Table',
      scrollView: 'data-testid explorer scroll view',
    },
  },
  SoloPanel: {
    url: (page: string) => `/d-solo/${page}`,
    Annotations: {
      marker: 'data-testid annotation-marker',
    },
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
    disabledInfo: 'Plugin disabled info',
  },
  PlaylistForm: {
    name: 'Playlist name',
    interval: 'Playlist interval',
    itemDelete: 'Delete playlist item',
  },
  BrowseDashbards: {
    table: {
      row: (uid: string) => `data-testid ${uid} row`,
      checkbox: (uid: string) => `data-testid ${uid} checkbox`,
    },
  },
  Search: {
    url: '/?search=openn',
    FolderView: {
      url: '/?search=open&layout=folders',
    },
  },
  PublicDashboards: {
    ListItem: {
      linkButton: 'public-dashboard-link-button',
      configButton: 'public-dashboard-configuration-button',
      trashcanButton: 'public-dashboard-remove-button',
    },
  },
  UserListPage: {
    org: {
      url: '/org/users',
    },
    admin: {
      url: '/admin/users',
    },
  },
};
