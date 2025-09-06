import { VersionedSelectorGroup } from '../types';

import { MIN_GRAFANA_VERSION } from './constants';

/**
 * Selectors grouped/defined in Pages
 */
export const versionedPages = {
  Alerting: {
    AddAlertRule: {
      url: {
        '10.1.0': '/alerting/new/alerting',
        [MIN_GRAFANA_VERSION]: '/alerting/new',
      },
    },
    EditAlertRule: {
      url: {
        [MIN_GRAFANA_VERSION]: (alertRuleUid: string) => `alerting/${alertRuleUid}/edit`,
      },
    },
  },
  Login: {
    url: {
      [MIN_GRAFANA_VERSION]: '/login',
    },
    username: {
      '10.2.3': 'data-testid Username input field',
      [MIN_GRAFANA_VERSION]: 'Username input field',
    },
    password: {
      '10.2.3': 'data-testid Password input field',
      [MIN_GRAFANA_VERSION]: 'Password input field',
    },
    submit: {
      '10.2.3': 'data-testid Login button',
      [MIN_GRAFANA_VERSION]: 'Login button',
    },
    skip: {
      '10.2.3': 'data-testid Skip change password button',
    },
  },
  PasswordlessLogin: {
    url: {
      [MIN_GRAFANA_VERSION]: '/login/passwordless/authenticate',
    },
    email: {
      '10.2.3': 'data-testid Email input field',
      [MIN_GRAFANA_VERSION]: 'Email input field',
    },
    submit: {
      '10.2.3': 'data-testid PasswordlessLogin button',
      [MIN_GRAFANA_VERSION]: 'PasswordlessLogin button',
    },
  },
  Home: {
    url: {
      [MIN_GRAFANA_VERSION]: '/',
    },
  },
  DataSource: {
    name: {
      '10.3.0': 'data-testid Data source settings page name input field',
      [MIN_GRAFANA_VERSION]: 'Data source settings page name input field',
    },
    delete: {
      [MIN_GRAFANA_VERSION]: 'Data source settings page Delete button',
    },
    readOnly: {
      '10.3.0': 'data-testid Data source settings page read only message',
      [MIN_GRAFANA_VERSION]: 'Data source settings page read only message',
    },
    saveAndTest: {
      '10.0.0': 'data-testid Data source settings page Save and Test button',
      [MIN_GRAFANA_VERSION]: 'Data source settings page Save and Test button',
    },
    alert: {
      '10.3.0': 'data-testid Data source settings page Alert',
      [MIN_GRAFANA_VERSION]: 'Data source settings page Alert',
    },
  },
  DataSources: {
    url: {
      [MIN_GRAFANA_VERSION]: '/datasources',
    },
    dataSources: {
      [MIN_GRAFANA_VERSION]: (dataSourceName: string) => `Data source list item ${dataSourceName}`,
    },
  },
  EditDataSource: {
    url: {
      '9.5.0': (dataSourceUid: string) => `/datasources/edit/${dataSourceUid}`,
    },
    settings: {
      '9.5.0': 'Datasource settings page basic settings',
    },
  },
  AddDataSource: {
    url: {
      [MIN_GRAFANA_VERSION]: '/datasources/new',
    },
    dataSourcePluginsV2: {
      '9.3.1': (pluginName: string) => `Add new data source ${pluginName}`,
      [MIN_GRAFANA_VERSION]: (pluginName: string) => `Data source plugin item ${pluginName}`,
    },
  },
  ConfirmModal: {
    delete: {
      '10.0.0': 'data-testid Confirm Modal Danger Button',
      [MIN_GRAFANA_VERSION]: 'Confirm Modal Danger Button',
    },
    input: {
      '12.2.0': 'data-testid Confirm Modal Input',
    },
  },
  SecretsManagement: {
    form: {
      '12.2.0': 'data-testid Secret Form',
    },
  },
  AddDashboard: {
    url: {
      [MIN_GRAFANA_VERSION]: '/dashboard/new',
    },
    itemButton: {
      '9.5.0': (title: string) => `data-testid ${title}`,
    },
    addNewPanel: {
      '11.1.0': 'data-testid Add new panel',
      '8.0.0': 'Add new panel',
      [MIN_GRAFANA_VERSION]: 'Add new panel',
    },
    itemButtonAddViz: {
      [MIN_GRAFANA_VERSION]: 'Add new visualization menu item',
    },
    addNewRow: {
      '11.1.0': 'data-testid Add new row',
      [MIN_GRAFANA_VERSION]: 'Add new row',
    },
    addNewPanelLibrary: {
      '11.1.0': 'data-testid Add new panel from panel library',
      [MIN_GRAFANA_VERSION]: 'Add new panel from panel library',
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
            '11.3.0': '/dashboard/new?orgId=1&editview=variables',
            [MIN_GRAFANA_VERSION]: '/dashboard/new?orgId=1&editview=templating',
          },
        },
        Edit: {
          url: {
            '11.3.0': (editIndex: string) => `/dashboard/new?orgId=1&editview=variables&editIndex=${editIndex}`,
            [MIN_GRAFANA_VERSION]: (editIndex: string) =>
              `/dashboard/new?orgId=1&editview=templating&editIndex=${editIndex}`,
          },
        },
      },
    },
  },
  ImportDashboard: {
    url: {
      [MIN_GRAFANA_VERSION]: '/dashboard/import',
    },
  },
  Dashboard: {
    url: {
      [MIN_GRAFANA_VERSION]: (uid: string) => `/d/${uid}`,
    },
    DashNav: {
      nav: {
        [MIN_GRAFANA_VERSION]: 'Dashboard navigation',
      },
      navV2: {
        [MIN_GRAFANA_VERSION]: 'data-testid Dashboard navigation',
      },
      publicDashboardTag: {
        '9.1.0': 'data-testid public dashboard tag',
      },
      shareButton: {
        '10.4.0': 'data-testid share-button',
      },
      scrollContainer: {
        '11.1.0': 'data-testid Dashboard canvas scroll container',
      },
      newShareButton: {
        container: {
          '11.1.0': 'data-testid new share button',
        },
        shareLink: {
          '11.1.0': 'data-testid new share link-button',
        },
        arrowMenu: {
          '11.1.0': 'data-testid new share button arrow menu',
        },
        menu: {
          container: {
            '11.1.0': 'data-testid new share button menu',
          },
          shareInternally: {
            '11.1.0': 'data-testid new share button share internally',
          },
          shareExternally: {
            '11.1.1': 'data-testid new share button share externally',
          },
          shareSnapshot: {
            '11.2.0': 'data-testid new share button share snapshot',
          },
        },
      },
      NewExportButton: {
        container: {
          '11.2.0': 'data-testid new export button',
        },
        arrowMenu: {
          '11.2.0': 'data-testid new export button arrow menu',
        },
        Menu: {
          container: {
            '11.2.0': 'data-testid new export button menu',
          },
          exportAsJson: {
            '11.2.0': 'data-testid new export button export as json',
          },
          exportAsImage: {
            '12.1.0': 'data-testid new export button export as image',
          },
        },
      },
      playlistControls: {
        prev: {
          '11.0.0': 'data-testid playlist previous dashboard button',
        },
        stop: {
          '11.0.0': 'data-testid playlist stop dashboard button',
        },
        next: {
          '11.0.0': 'data-testid playlist next dashboard button',
        },
      },
    },
    Controls: {
      '11.1.0': 'data-testid dashboard controls',
    },
    SubMenu: {
      submenu: {
        [MIN_GRAFANA_VERSION]: 'Dashboard submenu',
      },
      submenuItem: {
        [MIN_GRAFANA_VERSION]: 'data-testid template variable',
      },
      submenuItemLabels: {
        [MIN_GRAFANA_VERSION]: (item: string) => `data-testid Dashboard template variables submenu Label ${item}`,
      },
      submenuItemValueDropDownValueLinkTexts: {
        [MIN_GRAFANA_VERSION]: (item: string) =>
          `data-testid Dashboard template variables Variable Value DropDown value link text ${item}`,
      },
      submenuItemValueDropDownDropDown: {
        [MIN_GRAFANA_VERSION]: 'Variable options',
      },
      submenuItemValueDropDownOptionTexts: {
        [MIN_GRAFANA_VERSION]: (item: string) =>
          `data-testid Dashboard template variables Variable Value DropDown option text ${item}`,
      },
      Annotations: {
        annotationsWrapper: {
          '10.0.0': 'data-testid annotation-wrapper',
        },
        annotationLabel: {
          '10.0.0': (label: string) => `data-testid Dashboard annotations submenu Label ${label}`,
        },
        annotationToggle: {
          '10.0.0': (label: string) => `data-testid Dashboard annotations submenu Toggle ${label}`,
        },
      },
    },
    Settings: {
      Actions: {
        close: {
          '9.5.0': 'data-testid dashboard-settings-close',
        },
      },
      General: {
        deleteDashBoard: {
          '11.1.0': 'data-testid Dashboard settings page delete dashboard button',
        },
        sectionItems: {
          [MIN_GRAFANA_VERSION]: (item: string) => `Dashboard settings section item ${item}`,
        },
        saveDashBoard: {
          [MIN_GRAFANA_VERSION]: 'Dashboard settings aside actions Save button',
        },
        saveAsDashBoard: {
          [MIN_GRAFANA_VERSION]: 'Dashboard settings aside actions Save As button',
        },
        title: {
          '11.2.0': 'General',
        },
      },
      Annotations: {
        Edit: {
          urlParams: {
            [MIN_GRAFANA_VERSION]: (annotationIndex: string) => `editview=annotations&editIndex=${annotationIndex}`,
          },
        },
        List: {
          url: {
            [MIN_GRAFANA_VERSION]: (dashboardUid: string) => `/d/${dashboardUid}?editview=annotations`,
          },
          addAnnotationCTAV2: {
            [MIN_GRAFANA_VERSION]: 'data-testid Call to action button Add annotation query',
          },
          annotations: {
            '10.4.0': 'data-testid list-annotations',
          },
        },
        Settings: {
          name: {
            '11.1.0': 'data-testid Annotations settings name input',
            [MIN_GRAFANA_VERSION]: 'Annotations settings name input',
          },
        },
        NewAnnotation: {
          panelFilterSelect: {
            '10.0.0': 'data-testid annotations-panel-filter',
          },
          showInLabel: {
            '11.1.0': 'data-testid show-in-label',
          },
          previewInDashboard: {
            '10.0.0': 'data-testid annotations-preview',
          },
          delete: {
            '10.4.0': 'data-testid annotations-delete',
          },
          apply: {
            '10.4.0': 'data-testid annotations-apply',
          },
          enable: {
            '10.4.0': 'data-testid annotation-enable',
          },
          hide: {
            '10.4.0': 'data-testid annotation-hide',
          },
        },
      },
      Variables: {
        List: {
          url: {
            '11.3.0': (dashboardUid: string) => `/d/${dashboardUid}?editview=variables`,
            [MIN_GRAFANA_VERSION]: (dashboardUid: string) => `/d/${dashboardUid}?editview=templating`,
          },
          addVariableCTAV2: {
            [MIN_GRAFANA_VERSION]: 'data-testid Call to action button Add variable',
          },
          newButton: {
            [MIN_GRAFANA_VERSION]: 'Variable editor New variable button',
          },
          table: {
            [MIN_GRAFANA_VERSION]: 'Variable editor Table',
          },
          tableRowNameFields: {
            [MIN_GRAFANA_VERSION]: (variableName: string) => `Variable editor Table Name field ${variableName}`,
          },
          tableRowDefinitionFields: {
            '10.1.0': (variableName: string) => `Variable editor Table Definition field ${variableName}`,
          },
          tableRowArrowUpButtons: {
            [MIN_GRAFANA_VERSION]: (variableName: string) => `Variable editor Table ArrowUp button ${variableName}`,
          },
          tableRowArrowDownButtons: {
            [MIN_GRAFANA_VERSION]: (variableName: string) => `Variable editor Table ArrowDown button ${variableName}`,
          },
          tableRowDuplicateButtons: {
            [MIN_GRAFANA_VERSION]: (variableName: string) => `Variable editor Table Duplicate button ${variableName}`,
          },
          tableRowRemoveButtons: {
            [MIN_GRAFANA_VERSION]: (variableName: string) => `Variable editor Table Remove button ${variableName}`,
          },
        },
        Edit: {
          urlParams: {
            '11.3.0': (editIndex: string) => `editview=variables&editIndex=${editIndex}`,
            [MIN_GRAFANA_VERSION]: (editIndex: string) => `editview=templating&editIndex=${editIndex}`,
          },
          General: {
            headerLink: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Header link',
            },
            modeLabelNew: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Header mode New',
            },
            /**
             * @deprecated
             */
            modeLabelEdit: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Header mode Edit',
            },
            generalNameInput: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Name field',
            },
            generalNameInputV2: {
              [MIN_GRAFANA_VERSION]: 'data-testid Variable editor Form Name field',
            },
            generalTypeSelect: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Type select',
            },
            generalTypeSelectV2: {
              [MIN_GRAFANA_VERSION]: 'data-testid Variable editor Form Type select',
            },
            generalLabelInput: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Label field',
            },
            generalLabelInputV2: {
              [MIN_GRAFANA_VERSION]: 'data-testid Variable editor Form Label field',
            },
            generalHideSelect: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Hide select',
            },
            generalHideSelectV2: {
              [MIN_GRAFANA_VERSION]: 'data-testid Variable editor Form Hide select',
            },
            selectionOptionsAllowCustomValueSwitch: {
              [MIN_GRAFANA_VERSION]: 'data-testid Variable editor Form Allow Custom Value switch',
            },
            selectionOptionsMultiSwitch: {
              '10.4.0': 'data-testid Variable editor Form Multi switch',
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Multi switch',
            },
            selectionOptionsIncludeAllSwitch: {
              '10.4.0': 'data-testid Variable editor Form IncludeAll switch',
              [MIN_GRAFANA_VERSION]: 'Variable editor Form IncludeAll switch',
            },
            selectionOptionsCustomAllInput: {
              '10.4.0': 'data-testid Variable editor Form IncludeAll field',
              [MIN_GRAFANA_VERSION]: 'Variable editor Form IncludeAll field',
            },
            previewOfValuesOption: {
              '10.4.0': 'data-testid Variable editor Preview of Values option',
              [MIN_GRAFANA_VERSION]: 'Variable editor Preview of Values option',
            },
            submitButton: {
              '10.4.0': 'data-testid Variable editor Run Query button',
              [MIN_GRAFANA_VERSION]: 'Variable editor Submit button',
            },
            applyButton: {
              '9.3.0': 'data-testid Variable editor Apply button',
            },
          },
          QueryVariable: {
            closeButton: {
              [MIN_GRAFANA_VERSION]: 'data-testid Query Variable editor close button',
            },
            editor: {
              [MIN_GRAFANA_VERSION]: 'data-testid Query Variable editor',
            },
            previewButton: {
              [MIN_GRAFANA_VERSION]: 'data-testid Query Variable editor preview button',
            },
            queryOptionsDataSourceSelect: {
              '10.4.0': 'data-testid Select a data source',
              '10.0.0': 'data-testid Data source picker select container',
              [MIN_GRAFANA_VERSION]: 'Data source picker select container',
            },
            queryOptionsOpenButton: {
              [MIN_GRAFANA_VERSION]: 'data-testid Query Variable editor open button',
            },
            queryOptionsRefreshSelect: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query Refresh select',
            },
            queryOptionsRefreshSelectV2: {
              [MIN_GRAFANA_VERSION]: 'data-testid Variable editor Form Query Refresh select',
            },
            queryOptionsRegExInput: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query RegEx field',
            },
            queryOptionsRegExInputV2: {
              [MIN_GRAFANA_VERSION]: 'data-testid Variable editor Form Query RegEx field',
            },
            queryOptionsSortSelect: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query Sort select',
            },
            queryOptionsSortSelectV2: {
              [MIN_GRAFANA_VERSION]: 'data-testid Variable editor Form Query Sort select',
            },
            queryOptionsQueryInput: {
              '10.4.0': 'data-testid Variable editor Form Default Variable Query Editor textarea',
            },
            queryOptionsStaticOptionsRow: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query Static Options row',
            },
            queryOptionsStaticOptionsToggle: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query Static Options toggle',
            },
            queryOptionsStaticOptionsLabelInput: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query Static Options Label input',
            },
            queryOptionsStaticOptionsValueInput: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query Static Options Value input',
            },
            queryOptionsStaticOptionsDeleteButton: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query Static Options Delete button',
            },
            queryOptionsStaticOptionsAddButton: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query Static Options Add button',
            },
            queryOptionsStaticOptionsOrderDropdown: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query Static Options Order dropdown',
            },
            valueGroupsTagsEnabledSwitch: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query UseTags switch',
            },
            valueGroupsTagsTagsQueryInput: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query TagsQuery field',
            },
            valueGroupsTagsTagsValuesQueryInput: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Query TagsValuesQuery field',
            },
          },
          ConstantVariable: {
            constantOptionsQueryInput: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form Constant Query field',
            },
            constantOptionsQueryInputV2: {
              [MIN_GRAFANA_VERSION]: 'data-testid Variable editor Form Constant Query field',
            },
          },
          DatasourceVariable: {
            datasourceSelect: {
              [MIN_GRAFANA_VERSION]: 'data-testid datasource variable datasource type',
            },
            nameFilter: {
              [MIN_GRAFANA_VERSION]: 'data-testid datasource variable datasource name filter',
            },
          },
          TextBoxVariable: {
            textBoxOptionsQueryInput: {
              [MIN_GRAFANA_VERSION]: 'Variable editor Form TextBox Query field',
            },
            textBoxOptionsQueryInputV2: {
              [MIN_GRAFANA_VERSION]: 'data-testid Variable editor Form TextBox Query field',
            },
          },
          CustomVariable: {
            customValueInput: {
              [MIN_GRAFANA_VERSION]: 'data-testid custom-variable-input',
            },
          },
          IntervalVariable: {
            intervalsValueInput: {
              [MIN_GRAFANA_VERSION]: 'data-testid interval variable intervals input',
            },
            autoEnabledCheckbox: {
              '10.4.0': 'data-testid interval variable auto value checkbox',
            },
            stepCountIntervalSelect: {
              '10.4.0': 'data-testid interval variable step count input',
            },
            minIntervalInput: {
              '10.4.0': 'data-testid interval variable mininum interval input',
            },
          },
          GroupByVariable: {
            dataSourceSelect: {
              '10.4.0': 'data-testid Select a data source',
            },
            infoText: {
              '10.4.0': 'data-testid group by variable info text',
            },
            modeToggle: {
              '10.4.0': 'data-testid group by variable mode toggle',
            },
          },
          AdHocFiltersVariable: {
            datasourceSelect: {
              '10.4.0': 'data-testid Select a data source',
            },
            infoText: {
              '10.4.0': 'data-testid ad-hoc filters variable info text',
            },
            modeToggle: {
              '11.0.0': 'data-testid ad-hoc filters variable mode toggle',
            },
          },
        },
      },
    },
    Annotations: {
      marker: {
        '10.0.0': 'data-testid annotation-marker',
      },
    },
    Rows: {
      Repeated: {
        ConfigSection: {
          warningMessage: {
            '10.2.0': 'data-testid Repeated rows warning message',
          },
        },
      },
    },
  },
  Dashboards: {
    url: {
      [MIN_GRAFANA_VERSION]: '/dashboards',
    },
    dashboards: {
      '10.2.0': (title: string) => `Dashboard search item ${title}`,
    },
    toggleView: {
      [MIN_GRAFANA_VERSION]: 'data-testid radio-button',
    },
  },
  SaveDashboardAsModal: {
    newName: {
      '10.2.0': 'Save dashboard title field',
    },
    save: {
      '10.2.0': 'Save dashboard button',
    },
  },
  SaveDashboardModal: {
    save: {
      '10.2.0': 'Dashboard settings Save Dashboard Modal Save button',
    },
    saveVariables: {
      '10.2.0': 'Dashboard settings Save Dashboard Modal Save variables checkbox',
    },
    saveTimerange: {
      '10.2.0': 'Dashboard settings Save Dashboard Modal Save timerange checkbox',
    },
    saveRefresh: {
      '11.1.0': 'Dashboard settings Save Dashboard Modal Save refresh checkbox',
    },
    variablesWarningAlert: {
      '12.2.0': 'Dashboard settings Save Dashboard Modal Save variables Variables With Errors Warning Alert',
    },
  },
  SharePanelModal: {
    linkToRenderedImage: {
      [MIN_GRAFANA_VERSION]: 'Link to rendered image',
    },
  },
  ShareDashboardModal: {
    PublicDashboard: {
      WillBePublicCheckbox: {
        '9.1.0': 'data-testid public dashboard will be public checkbox',
      },
      LimitedDSCheckbox: {
        '9.1.0': 'data-testid public dashboard limited datasources checkbox',
      },
      CostIncreaseCheckbox: {
        '9.1.0': 'data-testid public dashboard cost may increase checkbox',
      },
      PauseSwitch: {
        '9.5.0': 'data-testid public dashboard pause switch',
      },
      EnableAnnotationsSwitch: {
        '9.3.0': 'data-testid public dashboard on off switch for annotations',
      },
      CreateButton: {
        '9.5.0': 'data-testid public dashboard create button',
      },
      DeleteButton: {
        '9.3.0': 'data-testid public dashboard delete button',
      },
      CopyUrlInput: {
        '9.1.0': 'data-testid public dashboard copy url input',
      },
      CopyUrlButton: {
        '9.1.0': 'data-testid public dashboard copy url button',
      },
      SettingsDropdown: {
        '10.1.0': 'data-testid public dashboard settings dropdown',
      },
      TemplateVariablesWarningAlert: {
        '9.1.0': 'data-testid public dashboard disabled template variables alert',
      },
      UnsupportedDataSourcesWarningAlert: {
        '9.5.0': 'data-testid public dashboard unsupported data sources alert',
      },
      NoUpsertPermissionsWarningAlert: {
        '9.5.0': 'data-testid public dashboard no upsert permissions alert',
      },
      EnableTimeRangeSwitch: {
        '9.4.0': 'data-testid public dashboard on off switch for time range',
      },
      EmailSharingConfiguration: {
        Container: {
          '9.5.0': 'data-testid email sharing config container',
        },
        ShareType: {
          '9.5.0': 'data-testid public dashboard share type',
        },
        EmailSharingInput: {
          '9.5.0': 'data-testid public dashboard email sharing input',
        },
        EmailSharingInviteButton: {
          '9.5.0': 'data-testid public dashboard email sharing invite button',
        },
        EmailSharingList: {
          '9.5.0': 'data-testid public dashboard email sharing list',
        },
        DeleteEmail: {
          '9.5.0': 'data-testid public dashboard delete email button',
        },
        ReshareLink: {
          '9.5.0': 'data-testid public dashboard reshare link button',
        },
      },
    },
    SnapshotScene: {
      url: {
        '11.1.0': (key: string) => `/dashboard/snapshot/${key}`,
      },
      PublishSnapshot: {
        '11.1.0': 'data-testid publish snapshot button',
      },
      CopyUrlButton: {
        '11.1.0': 'data-testid snapshot copy url button',
      },
      CopyUrlInput: {
        '11.1.0': 'data-testid snapshot copy url input',
      },
    },
  },
  ShareDashboardDrawer: {
    ShareInternally: {
      container: {
        '11.3.0': 'data-testid share internally drawer container',
      },
      lockTimeRangeSwitch: {
        '11.3.0': 'data-testid share internally lock time range switch',
      },
      shortenUrlSwitch: {
        '11.3.0': 'data-testid share internally shorten url switch',
      },
      copyUrlButton: {
        '11.3.0': 'data-testid share internally copy url button',
      },
      SharePanel: {
        preview: {
          '11.5.0': 'data-testid share panel internally image generation preview',
        },
        widthInput: {
          '11.5.0': 'data-testid share panel internally width input',
        },
        heightInput: {
          '11.5.0': 'data-testid share panel internally height input',
        },
        scaleFactorInput: {
          '11.5.0': 'data-testid share panel internally scale factor input',
        },
        generateImageButton: {
          '11.5.0': 'data-testid share panel internally generate image button',
        },
        downloadImageButton: {
          '11.5.0': 'data-testid share panel internally download image button',
        },
      },
    },
    ShareExternally: {
      container: {
        '11.3.0': 'data-testid share externally drawer container',
      },
      publicAlert: {
        '11.3.0': 'data-testid public share alert',
      },
      emailSharingAlert: {
        '11.3.0': 'data-testid email share alert',
      },
      shareTypeSelect: {
        '11.3.0': 'data-testid share externally share type select',
      },
      Creation: {
        PublicShare: {
          createButton: {
            '11.3.0': 'data-testid public share dashboard create button',
          },
          cancelButton: {
            '11.3.0': 'data-testid public share dashboard cancel button',
          },
        },
        EmailShare: {
          createButton: {
            '11.3.0': 'data-testid email share dashboard create button',
          },
          cancelButton: {
            '11.3.0': 'data-testid email share dashboard cancel button',
          },
        },
        willBePublicCheckbox: {
          '11.3.0': 'data-testid share dashboard will be public checkbox',
        },
      },
      Configuration: {
        enableTimeRangeSwitch: {
          '11.3.0': 'data-testid share externally enable time range switch',
        },
        enableAnnotationsSwitch: {
          '11.3.0': 'data-testid share externally enable annotations switch',
        },
        copyUrlButton: {
          '11.3.0': 'data-testid share externally copy url button',
        },
        revokeAccessButton: {
          '11.3.0': 'data-testid share externally revoke access button',
        },
        toggleAccessButton: {
          '11.3.0': 'data-testid share externally pause or resume access button',
        },
      },
    },
    ShareSnapshot: {
      url: {
        '11.3.0': (key: string) => `/dashboard/snapshot/${key}`,
      },
      container: {
        '11.3.0': 'data-testid share snapshot drawer container',
      },
      publishSnapshot: {
        '11.3.0': 'data-testid share snapshot publish button',
      },
      copyUrlButton: {
        '11.3.0': 'data-testid share snapshot copy url button',
      },
    },
  },
  ExportDashboardDrawer: {
    ExportAsJson: {
      container: {
        '11.3.0': 'data-testid export as json drawer container',
      },
      codeEditor: {
        '11.3.0': 'data-testid export as json code editor',
      },
      exportExternallyToggle: {
        '11.3.0': 'data-testid export as json externally switch',
      },
      saveToFileButton: {
        '11.3.0': 'data-testid export as json save to file button',
      },
      copyToClipboardButton: {
        '11.3.0': 'data-testid export as json copy to clipboard button',
      },
      cancelButton: {
        '11.3.0': 'data-testid export as json cancel button',
      },
    },
  },
  PublicDashboard: {
    page: {
      '9.5.0': 'public-dashboard-page',
    },
    NotAvailable: {
      container: {
        '9.5.0': 'public-dashboard-not-available',
      },
      title: {
        '9.5.0': 'public-dashboard-title',
      },
      pausedDescription: {
        '9.5.0': 'public-dashboard-paused-description',
      },
    },
    footer: {
      '11.0.0': 'public-dashboard-footer',
    },
  },
  PublicDashboardScene: {
    loadingPage: {
      '11.0.0': 'public-dashboard-scene-loading-page',
    },
    page: {
      '11.0.0': 'public-dashboard-scene-page',
    },
    controls: {
      '11.0.0': 'public-dashboard-controls',
    },
  },
  RequestViewAccess: {
    form: {
      '9.5.0': 'request-view-access-form',
    },
    recipientInput: {
      '9.5.0': 'request-view-access-recipient-input',
    },
    submitButton: {
      '9.5.0': 'request-view-access-submit-button',
    },
  },
  PublicDashboardConfirmAccess: {
    submitButton: {
      '10.2.0': 'data-testid confirm-access-submit-button',
    },
  },
  Explore: {
    url: {
      [MIN_GRAFANA_VERSION]: '/explore',
    },
    General: {
      container: {
        [MIN_GRAFANA_VERSION]: 'data-testid Explore',
      },
      graph: {
        [MIN_GRAFANA_VERSION]: 'Explore Graph',
      },
      table: {
        [MIN_GRAFANA_VERSION]: 'Explore Table',
      },
      scrollView: {
        '9.0.0': 'data-testid explorer scroll view',
      },
      addFromQueryLibrary: {
        '11.5.0': 'data-testid explore add from query library button',
      },
    },
    QueryHistory: {
      container: {
        '11.1.0': 'data-testid QueryHistory',
      },
    },
  },
  SoloPanel: {
    url: {
      [MIN_GRAFANA_VERSION]: (page: string) => `/d-solo/${page}`,
    },
  },
  PluginsList: {
    page: {
      [MIN_GRAFANA_VERSION]: 'Plugins list page',
    },
    list: {
      [MIN_GRAFANA_VERSION]: 'Plugins list',
    },
    listItem: {
      [MIN_GRAFANA_VERSION]: 'Plugins list item',
    },
    signatureErrorNotice: {
      '10.3.0': 'data-testid Unsigned plugins notice',
      [MIN_GRAFANA_VERSION]: 'Unsigned plugins notice',
    },
  },
  PluginPage: {
    page: {
      [MIN_GRAFANA_VERSION]: 'Plugin page',
    },
    signatureInfo: {
      '10.3.0': 'data-testid Plugin signature info',
      [MIN_GRAFANA_VERSION]: 'Plugin signature info',
    },
    disabledInfo: {
      '10.3.0': 'data-testid Plugin disabled info',
      [MIN_GRAFANA_VERSION]: 'Plugin disabled info',
    },
  },
  PlaylistForm: {
    name: {
      [MIN_GRAFANA_VERSION]: 'Playlist name',
    },
    interval: {
      [MIN_GRAFANA_VERSION]: 'Playlist interval',
    },
    itemDelete: {
      '10.2.0': 'data-testid playlist-form-delete-item',
    },
  },
  BrowseDashboards: {
    table: {
      body: {
        '10.2.0': 'data-testid browse-dashboards-table',
      },
      row: {
        '10.2.0': (name: string) => `data-testid browse dashboards row ${name}`,
      },
      checkbox: {
        '10.0.0': (uid: string) => `data-testid ${uid} checkbox`,
      },
    },
    NewFolderForm: {
      form: {
        '10.2.0': 'data-testid new folder form',
      },
      nameInput: {
        '10.2.0': 'data-testid new-folder-name-input',
      },
      createButton: {
        '10.2.0': 'data-testid new-folder-create-button',
      },
    },
  },
  SearchDashboards: {
    table: {
      '10.2.0': 'Search results table',
    },
  },
  Search: {
    url: {
      '9.3.0': '/?search=openn',
    },
    FolderView: {
      url: {
        '9.3.0': '/?search=open&layout=folders',
      },
    },
  },
  PublicDashboards: {
    ListItem: {
      linkButton: {
        '9.3.0': 'public-dashboard-link-button',
      },
      configButton: {
        '9.3.0': 'public-dashboard-configuration-button',
      },
      trashcanButton: {
        '9.3.0': 'public-dashboard-remove-button',
      },
      pauseSwitch: {
        '10.1.0': 'data-testid public dashboard pause switch',
      },
    },
  },
  UserListPage: {
    tabs: {
      allUsers: {
        '10.0.0': 'data-testid all-users-tab',
      },
      orgUsers: {
        '10.0.0': 'data-testid org-users-tab',
      },
      anonUserDevices: {
        '10.2.3': 'data-testid anon-user-devices-tab',
      },
      publicDashboardsUsers: {
        '10.0.0': 'data-testid public-dashboards-users-tab',
      },
      users: {
        '10.0.0': 'data-testid users-tab',
      },
    },
    org: {
      url: {
        '10.2.0': '/admin/users',
        '9.5.0': '/org/users',
      },
    },
    admin: {
      url: {
        '9.5.0': '/admin/users',
      },
    },
    publicDashboards: {
      container: {
        '11.1.0': 'data-testid public-dashboards-users-list',
      },
    },
    UserListAdminPage: {
      container: {
        '10.0.0': 'data-testid user-list-admin-page',
      },
    },
    UsersListPage: {
      container: {
        '10.0.0': 'data-testid users-list-page',
      },
    },
    UserAnonListPage: {
      container: {
        '10.4.0': 'data-testid user-anon-list-page',
      },
    },
    UsersListPublicDashboardsPage: {
      container: {
        '10.0.0': 'data-testid users-list-public-dashboards-page',
      },
      DashboardsListModal: {
        listItem: {
          '10.0.0': (uid: string) => `data-testid dashboards-list-item-${uid}`,
        },
      },
    },
  },
  ProfilePage: {
    url: {
      '10.2.0': '/profile',
    },
  },
  Plugin: {
    url: {
      [MIN_GRAFANA_VERSION]: (pluginId: string) => `/plugins/${pluginId}`,
    },
  },
  MigrateToCloud: {
    url: {
      '11.2.0': '/admin/migrate-to-cloud',
    },
  },
} satisfies VersionedSelectorGroup;

export type VersionedPages = typeof versionedPages;
