import { __awaiter } from "tslib";
import { render, waitFor, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Route } from 'react-router-dom';
import { byRole, byTestId, byText } from 'testing-library-selector';
import { selectors } from '@grafana/e2e-selectors';
import { locationService } from '@grafana/runtime';
import { TestProvider } from '../../../../../../test/helpers/TestProvider';
import { AlertmanagerChoice } from '../../../../../plugins/datasource/alertmanager/types';
import { DashboardSearchItemType } from '../../../../search/types';
import { mockAlertRuleApi, mockApi, mockExportApi, mockSearchApi, setupMswServer } from '../../mockApi';
import { getGrafanaRule, mockDataSource } from '../../mocks';
import { mockAlertmanagerChoiceResponse } from '../../mocks/alertmanagerApi';
import { setupDataSources } from '../../testSetup/datasources';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import GrafanaModifyExport from './GrafanaModifyExport';
jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
    AppChromeUpdate: ({ actions }) => React.createElement("div", null, actions),
}));
jest.mock('react-virtualized-auto-sizer', () => {
    return ({ children }) => children({ height: 600, width: 1 });
});
jest.mock('@grafana/ui', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/ui')), { CodeEditor: ({ value }) => React.createElement("textarea", { "data-testid": "code-editor", value: value, readOnly: true }) })));
const ui = {
    loading: byText('Loading the rule'),
    form: {
        nameInput: byRole('textbox', { name: 'name' }),
        folder: byTestId('folder-picker'),
        folderContainer: byTestId(selectors.components.FolderPicker.containerV2),
        group: byTestId('group-picker'),
        annotationKey: (idx) => byTestId(`annotation-key-${idx}`),
        annotationValue: (idx) => byTestId(`annotation-value-${idx}`),
        labelKey: (idx) => byTestId(`label-key-${idx}`),
        labelValue: (idx) => byTestId(`label-value-${idx}`),
    },
    exportButton: byRole('button', { name: 'Export' }),
    exportDrawer: {
        dialog: byRole('dialog', { name: /Export Group/ }),
        jsonTab: byRole('tab', { name: /JSON/ }),
        yamlTab: byRole('tab', { name: /YAML/ }),
        editor: byTestId('code-editor'),
        loadingSpinner: byTestId('Spinner'),
    },
};
const dataSources = {
    default: mockDataSource({ type: 'prometheus', name: 'Prom', isDefault: true }, { alerting: true }),
};
function renderModifyExport(ruleId) {
    locationService.push(`/alerting/${ruleId}/modify-export`);
    render(React.createElement(Route, { path: "/alerting/:id/modify-export", component: GrafanaModifyExport }), { wrapper: TestProvider });
}
const server = setupMswServer();
mockAlertmanagerChoiceResponse(server, {
    alertmanagersChoice: AlertmanagerChoice.Internal,
    numExternalAlertmanagers: 0,
});
describe('GrafanaModifyExport', () => {
    setupDataSources(dataSources.default);
    const grafanaRule = getGrafanaRule(undefined, {
        uid: 'test-rule-uid',
        title: 'cpu-usage',
        namespace_uid: 'folder-test-uid',
        namespace_id: 1,
        data: [
            {
                refId: 'A',
                datasourceUid: dataSources.default.uid,
                queryType: 'alerting',
                relativeTimeRange: { from: 1000, to: 2000 },
                model: {
                    refId: 'A',
                    expression: 'vector(1)',
                    queryType: 'alerting',
                    datasource: { uid: dataSources.default.uid, type: 'prometheus' },
                },
            },
        ],
    });
    it('Should render edit form for the specified rule', () => __awaiter(void 0, void 0, void 0, function* () {
        mockApi(server).eval({ results: { A: { frames: [] } } });
        mockSearchApi(server).search([
            {
                title: grafanaRule.namespace.name,
                uid: 'folder-test-uid',
                id: 1,
                url: '',
                tags: [],
                type: DashboardSearchItemType.DashFolder,
            },
        ]);
        mockAlertRuleApi(server).rulerRules(GRAFANA_RULES_SOURCE_NAME, {
            [grafanaRule.namespace.name]: [{ name: grafanaRule.group.name, interval: '1m', rules: [grafanaRule.rulerRule] }],
        });
        mockAlertRuleApi(server).rulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, grafanaRule.namespace.name, grafanaRule.group.name, { name: grafanaRule.group.name, interval: '1m', rules: [grafanaRule.rulerRule] });
        mockExportApi(server).modifiedExport(grafanaRule.namespace.name, {
            yaml: 'Yaml Export Content',
        });
        const user = userEvent.setup();
        renderModifyExport('test-rule-uid');
        yield waitForElementToBeRemoved(() => ui.loading.get());
        expect(yield ui.form.nameInput.find()).toHaveValue('cpu-usage');
        yield user.click(ui.exportButton.get());
        const drawer = yield ui.exportDrawer.dialog.find();
        expect(drawer).toBeInTheDocument();
        expect(ui.exportDrawer.yamlTab.get(drawer)).toHaveAttribute('aria-selected', 'true');
        yield waitFor(() => {
            expect(ui.exportDrawer.editor.get(drawer)).toHaveTextContent('Yaml Export Content');
        });
    }));
});
//# sourceMappingURL=GrafanaModifyExport.test.js.map