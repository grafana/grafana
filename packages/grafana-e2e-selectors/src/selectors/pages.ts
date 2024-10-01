import { Components } from './components';

/**
 * Selectors grouped/defined in Pages
 *
 * @alpha
 */
export const Pages = {
  Login: {
    url: '/login',
    username: 'data-testid Username input field',
    password: 'data-testid Password input field',
    submit: 'data-testid Login button',
    skip: 'data-testid Skip change password button',
  },
  Home: {
    url: '/',
  },
  DataSource: {
    name: 'data-testid Data source settings page name input field',
    delete: 'Data source settings page Delete button',
    readOnly: 'data-testid Data source settings page read only message',
    saveAndTest: 'data-testid Data source settings page Save and Test button',
    alert: 'data-testid Data source settings page Alert',
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
    delete: 'data-testid Confirm Modal Danger Button',
  },
  AddDashboard: {
    url: '/dashboard/new',
    itemButton: (title: string) => `data-testid ${title}`,
    addNewPanel: 'data-testid Add new panel',
    addNewRow: 'data-testid Add new row',
    addNewPanelLibrary: 'data-testid Add new panel from panel library',
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
      shareButton: 'data-testid share-button',
      scrollContainer: 'data-testid Dashboard canvas scroll container',
      newShareButton: {
        container: 'data-testid new share button',
        shareLink: 'data-testid new share link-button',
        arrowMenu: 'data-testid new share button arrow menu',
        menu: {
          container: 'data-testid new share button menu',
          shareInternally: 'data-testid new share button share internally',
          shareExternally: 'data-testid new share button share externally',
          shareSnapshot: 'data-testid new share button share snapshot',
        },
      },
      NewExportButton: {
        container: 'data-testid new export button',
        arrowMenu: 'data-testid new export button arrow menu',
        Menu: {
          container: 'data-testid new export button menu',
          exportAsJson: 'data-testid new export button export as json',
        },
      },
      playlistControls: {
        prev: 'data-testid playlist previous dashboard button',
        stop: 'data-testid playlist stop dashboard button',
        next: 'data-testid playlist next dashboard button',
      },
    },
    Controls: 'data-testid dashboard controls',
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
        deleteDashBoard: 'data-testid Dashboard settings page delete dashboard button',
        sectionItems: (item: string) => `Dashboard settings section item ${item}`,
        saveDashBoard: 'Dashboard settings aside actions Save button',
        saveAsDashBoard: 'Dashboard settings aside actions Save As button',
        /**
         * @deprecated use components.TimeZonePicker.containerV2 from Grafana 8.3 instead
         */
        timezone: 'Time zone picker select container',
        title: 'General',
      },
      Annotations: {
        List: {
          /**
           * @deprecated use addAnnotationCTAV2 from Grafana 8.3 instead
           */
          addAnnotationCTA: Components.CallToActionCard.button('Add annotation query'),
          addAnnotationCTAV2: Components.CallToActionCard.buttonV2('Add annotation query'),
          annotations: 'data-testid list-annotations',
        },
        Settings: {
          name: 'data-testid Annotations settings name input',
        },
        NewAnnotation: {
          panelFilterSelect: 'data-testid annotations-panel-filter',
          showInLabel: 'data-testid show-in-label',
          previewInDashboard: 'data-testid annotations-preview',
          delete: 'data-testid annotations-delete',
          apply: 'data-testid annotations-apply',
          enable: 'data-testid annotation-enable',
          hide: 'data-testid annotation-hide',
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
            selectionOptionsMultiSwitch: 'data-testid Variable editor Form Multi switch',
            selectionOptionsIncludeAllSwitch: 'data-testid Variable editor Form IncludeAll switch',
            selectionOptionsCustomAllInput: 'data-testid Variable editor Form IncludeAll field',
            previewOfValuesOption: 'data-testid Variable editor Preview of Values option',
            submitButton: 'data-testid Variable editor Run Query button',
            applyButton: 'data-testid Variable editor Apply button',
          },
          QueryVariable: {
            queryOptionsDataSourceSelect: Components.DataSourcePicker.inputV2,
            queryOptionsRefreshSelect: 'Variable editor Form Query Refresh select',
            queryOptionsRefreshSelectV2: 'data-testid Variable editor Form Query Refresh select',
            queryOptionsRegExInput: 'Variable editor Form Query RegEx field',
            queryOptionsRegExInputV2: 'data-testid Variable editor Form Query RegEx field',
            queryOptionsSortSelect: 'Variable editor Form Query Sort select',
            queryOptionsSortSelectV2: 'data-testid Variable editor Form Query Sort select',
            queryOptionsQueryInput: 'data-testid Variable editor Form Default Variable Query Editor textarea',
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
            autoEnabledCheckbox: 'data-testid interval variable auto value checkbox',
            stepCountIntervalSelect: 'data-testid interval variable step count input',
            minIntervalInput: 'data-testid interval variable mininum interval input',
          },
          GroupByVariable: {
            dataSourceSelect: Components.DataSourcePicker.inputV2,
            infoText: 'data-testid group by variable info text',
            modeToggle: 'data-testid group by variable mode toggle',
          },
          AdHocFiltersVariable: {
            datasourceSelect: Components.DataSourcePicker.inputV2,
            infoText: 'data-testid ad-hoc filters variable info text',
            modeToggle: 'data-testid ad-hoc filters variable mode toggle',
          },
        },
      },
    },
    Annotations: {
      marker: 'data-testid annotation-marker',
    },
    Rows: {
      Repeated: {
        ConfigSection: {
          warningMessage: 'data-testid Repeated rows warning message',
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
    saveRefresh: 'Dashboard settings Save Dashboard Modal Save refresh checkbox',
  },
  SharePanelModal: {
    linkToRenderedImage: 'Link to rendered image',
  },
  ShareDashboardModal: {
    PublicDashboard: {
      WillBePublicCheckbox: 'data-testid public dashboard will be public checkbox',
      LimitedDSCheckbox: 'data-testid public dashboard limited datasources checkbox',
      CostIncreaseCheckbox: 'data-testid public dashboard cost may increase checkbox',
      PauseSwitch: 'data-testid public dashboard pause switch',
      EnableAnnotationsSwitch: 'data-testid public dashboard on off switch for annotations',
      CreateButton: 'data-testid public dashboard create button',
      DeleteButton: 'data-testid public dashboard delete button',
      CopyUrlInput: 'data-testid public dashboard copy url input',
      CopyUrlButton: 'data-testid public dashboard copy url button',
      SettingsDropdown: 'data-testid public dashboard settings dropdown',
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
    SnapshotScene: {
      url: (key: string) => `/dashboard/snapshot/${key}`,
      PublishSnapshot: 'data-testid publish snapshot button',
      CopyUrlButton: 'data-testid snapshot copy url button',
      CopyUrlInput: 'data-testid snapshot copy url input',
    },
  },
  ShareDashboardDrawer: {
    ShareInternally: {
      container: 'data-testid share internally drawer container',
      lockTimeRangeSwitch: 'data-testid share internally lock time range switch',
      shortenUrlSwitch: 'data-testid share internally shorten url switch',
      copyUrlButton: 'data-testid share internally copy url button',
    },
    ShareExternally: {
      container: 'data-testid share externally drawer container',
      publicAlert: 'data-testid public share alert',
      emailSharingAlert: 'data-testid email share alert',
      shareTypeSelect: 'data-testid share externally share type select',
      Creation: {
        PublicShare: {
          createButton: 'data-testid public share dashboard create button',
          cancelButton: 'data-testid public share dashboard cancel button',
        },
        EmailShare: {
          createButton: 'data-testid email share dashboard create button',
          cancelButton: 'data-testid email share dashboard cancel button',
        },
        willBePublicCheckbox: 'data-testid share dashboard will be public checkbox',
      },
      Configuration: {
        enableTimeRangeSwitch: 'data-testid share externally enable time range switch',
        enableAnnotationsSwitch: 'data-testid share externally enable annotations switch',
        copyUrlButton: 'data-testid share externally copy url button',
        revokeAccessButton: 'data-testid share externally revoke access button',
        toggleAccessButton: 'data-testid share externally pause or resume access button',
      },
    },
    ShareSnapshot: {
      url: (key: string) => `/dashboard/snapshot/${key}`,
      container: 'data-testid share snapshot drawer container',
      publishSnapshot: 'data-testid share snapshot publish button',
      copyUrlButton: 'data-testid share snapshot copy url button',
    },
  },
  ExportDashboardDrawer: {
    ExportAsJson: {
      container: 'data-testid export as json drawer container',
      codeEditor: 'data-testid export as json code editor',
      exportExternallyToggle: 'data-testid export as json externally switch',
      saveToFileButton: 'data-testid export as json save to file button',
      copyToClipboardButton: 'data-testid export as json copy to clipboard button',
      cancelButton: 'data-testid export as json cancel button',
    },
  },
  PublicDashboard: {
    page: 'public-dashboard-page',
    NotAvailable: {
      container: 'public-dashboard-not-available',
      title: 'public-dashboard-title',
      pausedDescription: 'public-dashboard-paused-description',
    },
    footer: 'public-dashboard-footer',
  },
  PublicDashboardScene: {
    loadingPage: 'public-dashboard-scene-loading-page',
    page: 'public-dashboard-scene-page',
    controls: 'public-dashboard-controls',
  },
  RequestViewAccess: {
    form: 'request-view-access-form',
    recipientInput: 'request-view-access-recipient-input',
    submitButton: 'request-view-access-submit-button',
  },
  PublicDashboardConfirmAccess: {
    submitButton: 'data-testid confirm-access-submit-button',
  },
  Explore: {
    url: '/explore',
    General: {
      container: 'data-testid Explore',
      graph: 'Explore Graph',
      table: 'Explore Table',
      scrollView: 'data-testid explorer scroll view',
    },
    QueryHistory: {
      container: 'data-testid QueryHistory',
    },
  },
  SoloPanel: {
    url: (page: string) => `/d-solo/${page}`,
  },
  PluginsList: {
    page: 'Plugins list page',
    list: 'Plugins list',
    listItem: 'Plugins list item',
    signatureErrorNotice: 'data-testid Unsigned plugins notice',
  },
  PluginPage: {
    page: 'Plugin page',
    signatureInfo: 'data-testid Plugin signature info',
    disabledInfo: 'data-testid Plugin disabled info',
  },
  PlaylistForm: {
    name: 'Playlist name',
    interval: 'Playlist interval',
    itemDelete: 'data-testid playlist-form-delete-item',
  },
  BrowseDashboards: {
    table: {
      body: 'data-testid browse-dashboards-table',
      row: (name: string) => `data-testid browse dashboards row ${name}`,
      checkbox: (uid: string) => `data-testid ${uid} checkbox`,
    },
    NewFolderForm: {
      form: 'data-testid new folder form',
      nameInput: 'data-testid new-folder-name-input',
      createButton: 'data-testid new-folder-create-button',
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
      pauseSwitch: 'data-testid public dashboard pause switch',
    },
  },
  UserListPage: {
    tabs: {
      allUsers: 'data-testid all-users-tab',
      orgUsers: 'data-testid org-users-tab',
      anonUserDevices: 'data-testid anon-user-devices-tab',
      publicDashboardsUsers: 'data-testid public-dashboards-users-tab',
      users: 'data-testid users-tab',
    },
    org: {
      url: '/org/users',
    },
    admin: {
      url: '/admin/users',
    },
    publicDashboards: {
      container: 'data-testid public-dashboards-users-list',
    },
    UserListAdminPage: {
      container: 'data-testid user-list-admin-page',
    },
    UsersListPage: {
      container: 'data-testid users-list-page',
    },
    UserAnonListPage: {
      container: 'data-testid user-anon-list-page',
    },
    UsersListPublicDashboardsPage: {
      container: 'data-testid users-list-public-dashboards-page',
      DashboardsListModal: {
        listItem: (uid: string) => `data-testid dashboards-list-item-${uid}`,
      },
    },
  },
  ProfilePage: {
    url: '/profile',
  },
};
