import { MIN_GRAFANA_VERSION } from './constants';
export const versionedComponents = {
    TimePicker: {
        openButton: 'data-testid TimePicker Open Button',
        fromField: 'data-testid Time Range from field',
        toField: 'data-testid Time Range to field',
        applyTimeRange: 'data-testid TimePicker submit button',
        absoluteTimeRangeTitle: 'data-testid-absolute-time-range-narrow',
    },
    Menu: {
        MenuComponent: (title: string) => `${title} menu`,
        MenuGroup: (title: string) => `${title} menu group`,
        MenuItem: (title: string) => `${title} menu item`,
        SubMenu: {
            container: 'data-testid SubMenu container',
            icon: 'data-testid SubMenu icon',
        },
    },
    Panels: {
        Panel: {
            title: (title: string) => `data-testid Panel header ${title}`,
            headerCornerInfo: (mode: string) => `Panel header ${mode}`,
            status: (_: string) => 'Panel status',
            toggleTableViewPanel: (title: string) => `data-testid Panel header ${title}`,
            PanelDataErrorMessage: 'data-testid Panel data error message',
            menuItems: (item: string) => `data-testid Panel menu item ${item}`,
            menu: (item: string) => `data-testid Panel menu ${item}`,
        },
        Visualization: {
            Table: {
                header: 'table header',
                footer: 'table-footer',
                body: 'data-testid table body',
            },
        },
    },
    VizLegend: {
        seriesName: (name: string) => `VizLegend series ${name}`,
    },
    Drawer: {
        General: {
            title: (title: string) => `Drawer title ${title}`,
        },
    },
    PanelEditor: {
        General: {
            content: 'data-testid Panel editor content',
        },
        applyButton: 'data-testid Apply changes and go back to dashboard',
        toggleVizPicker: 'data-testid toggle-viz-picker',
        OptionsPane: {
            content: 'data-testid Panel editor option pane content',
            fieldLabel: (type: string) => `${type} field property editor`,
            fieldInput: (title: string) => `data-testid Panel editor option pane field input ${title}`,
        },
    },
    RefreshPicker: {
        runButtonV2: 'RefreshPicker run button',
    },
    QueryTab: {
        addQuery: 'data-testid query-tab-add-query',
        addExpression: 'data-testid query-tab-add-expression',
    },
    QueryEditorRows: {
        rows: 'Query editor row',
    },
    QueryEditorRow: {
        title: (refId: string) => `Query editor row title ${refId}`,
        actionButton: (title: string) => `data-testid ${title}`,
    },
    AlertRules: {
        previewButton: 'data-testid alert-rule preview-button',
        ruleNameField: 'data-testid alert-rule name-field',
        newFolderButton: 'data-testid alert-rule new-folder-button',
        newFolderNameField: 'data-testid alert-rule name-folder-name-field',
        newFolderNameCreateButton: 'data-testid alert-rule name-folder-name-create-button',
        newEvaluationGroupButton: 'data-testid alert-rule new-evaluation-group-button',
        newEvaluationGroupName: 'data-testid alert-rule new-evaluation-group-name',
        newEvaluationGroupInterval: 'data-testid alert-rule new-evaluation-group-interval',
        newEvaluationGroupCreate: 'data-testid alert-rule new-evaluation-group-create-button',
    },
    Alert: {
        alertV2: (severity: string) => `data-testid Alert ${severity}`,
    },
    PageToolbar: {
        item: (tooltip: string) => `${tooltip}`,
        showMoreItems: 'Show more items',
        itemButton: {
            //did not exist prior to 9.5.0
            ['9.5.0']: (title: string) => `data-testid ${title}`,
        },
        itemButtonTitle: 'Add button',
    },
    QueryEditorToolbarItem: {
        button: (title: string) => `QueryEditor toolbar item button ${title}`,
    },
    OptionsGroup: {
        group: (title?: string) => (title ? `data-testid Options group ${title}` : 'data-testid Options group'),
        toggle: (title?: string) => title ? `data-testid Options group ${title} toggle` : 'data-testid Options group toggle',
        groupTitle: 'Panel options',
    },
    PluginVisualization: {
        item: (title: string) => `Plugin visualization item ${title}`,
    },
    Select: {
        option: 'data-testid Select option',
        input: () => 'input[id*="time-options-input"]',
        singleValue: () => 'div[class*="-singleValue"]',
    },
    DataSourcePicker: {
        container: 'data-testid Data source picker select container',
    },
    TimeZonePicker: {
        containerV2: 'data-testid Time zone picker select container',
        changeTimeSettingsButton: 'data-testid Time zone picker Change time settings button',
    },
    CodeEditor: {
        container: 'data-testid Code editor container',
    },
    Annotations: {
        editor: {
            testButton: 'data-testid annotations-test-button',
            resultContainer: 'data-testid annotations-query-result-container',
        },
    },
    QueryField: {
        container: 'data-testid Query field',
    },
};
