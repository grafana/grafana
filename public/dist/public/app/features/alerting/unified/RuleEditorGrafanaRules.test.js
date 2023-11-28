import { __awaiter } from "tslib";
import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byRole } from 'testing-library-selector';
import { setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import { GrafanaAlertStateDecision, PromApplication } from 'app/types/unified-alerting-dto';
import { searchFolders } from '../../../../app/features/manage-dashboards/state/actions';
import { discoverFeatures } from './api/buildInfo';
import { fetchRulerRules, fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup } from './api/ruler';
import { grantUserPermissions, mockDataSource, MockDataSourceSrv } from './mocks';
import { fetchRulerRulesIfNotFetchedYet } from './state/actions';
import * as config from './utils/config';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';
import { getDefaultQueries } from './utils/rule-form';
jest.mock('./components/rule-editor/ExpressionEditor', () => ({
    // eslint-disable-next-line react/display-name
    ExpressionEditor: ({ value, onChange }) => (React.createElement("input", { value: value, "data-testid": "expr", onChange: (e) => onChange(e.target.value) })),
}));
jest.mock('./api/buildInfo');
jest.mock('./api/ruler');
jest.mock('../../../../app/features/manage-dashboards/state/actions');
jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
    AppChromeUpdate: ({ actions }) => React.createElement("div", null, actions),
}));
// there's no angular scope in test and things go terribly wrong when trying to render the query editor row.
// lets just skip it
jest.mock('app/features/query/components/QueryEditorRow', () => ({
    // eslint-disable-next-line react/display-name
    QueryEditorRow: () => React.createElement("p", null, "hi"),
}));
jest.spyOn(config, 'getAllDataSources');
jest.setTimeout(60 * 1000);
const mocks = {
    getAllDataSources: jest.mocked(config.getAllDataSources),
    searchFolders: jest.mocked(searchFolders),
    api: {
        discoverFeatures: jest.mocked(discoverFeatures),
        fetchRulerRulesGroup: jest.mocked(fetchRulerRulesGroup),
        setRulerRuleGroup: jest.mocked(setRulerRuleGroup),
        fetchRulerRulesNamespace: jest.mocked(fetchRulerRulesNamespace),
        fetchRulerRules: jest.mocked(fetchRulerRules),
        fetchRulerRulesIfNotFetchedYet: jest.mocked(fetchRulerRulesIfNotFetchedYet),
    },
};
const getLabelInput = (selector) => within(selector).getByRole('combobox');
describe('RuleEditor grafana managed rules', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        contextSrv.isEditor = true;
        contextSrv.hasEditPermissionInFolders = true;
        grantUserPermissions([
            AccessControlAction.AlertingRuleRead,
            AccessControlAction.AlertingRuleUpdate,
            AccessControlAction.AlertingRuleDelete,
            AccessControlAction.AlertingRuleCreate,
            AccessControlAction.DataSourcesRead,
            AccessControlAction.DataSourcesWrite,
            AccessControlAction.DataSourcesCreate,
            AccessControlAction.FoldersWrite,
            AccessControlAction.FoldersRead,
            AccessControlAction.AlertingRuleExternalRead,
            AccessControlAction.AlertingRuleExternalWrite,
        ]);
    });
    it('can create new grafana managed alert', () => __awaiter(void 0, void 0, void 0, function* () {
        const dataSources = {
            default: mockDataSource({
                type: 'prometheus',
                name: 'Prom',
                isDefault: true,
            }, { alerting: false }),
        };
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
        mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
        mocks.api.setRulerRuleGroup.mockResolvedValue();
        mocks.api.fetchRulerRulesNamespace.mockResolvedValue([]);
        mocks.api.fetchRulerRulesGroup.mockResolvedValue({
            name: 'group2',
            rules: [],
        });
        mocks.api.fetchRulerRules.mockResolvedValue({
            'Folder A': [
                {
                    name: 'group1',
                    rules: [],
                },
            ],
            namespace2: [
                {
                    name: 'group2',
                    rules: [],
                },
            ],
        });
        mocks.searchFolders.mockResolvedValue([
            {
                title: 'Folder A',
                id: 1,
            },
            {
                title: 'Folder B',
                id: 2,
            },
            {
                title: 'Folder / with slash',
                id: 2,
            },
        ]);
        mocks.api.discoverFeatures.mockResolvedValue({
            application: PromApplication.Prometheus,
            features: {
                rulerApiEnabled: false,
            },
        });
        renderRuleEditor();
        yield waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));
        yield userEvent.type(yield ui.inputs.name.find(), 'my great new rule');
        const folderInput = yield ui.inputs.folder.find();
        yield clickSelectOption(folderInput, 'Folder A');
        const groupInput = yield ui.inputs.group.find();
        yield userEvent.click(byRole('combobox').get(groupInput));
        yield clickSelectOption(groupInput, 'group1');
        yield userEvent.type(ui.inputs.annotationValue(1).get(), 'some description');
        // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
        yield userEvent.click(ui.buttons.addLabel.get(), { pointerEventsCheck: PointerEventsCheckLevel.Never });
        yield userEvent.type(getLabelInput(ui.inputs.labelKey(0).get()), 'severity{enter}');
        yield userEvent.type(getLabelInput(ui.inputs.labelValue(0).get()), 'warn{enter}');
        //8 segons
        // save and check what was sent to backend
        yield userEvent.click(ui.buttons.saveAndExit.get());
        // 9seg
        yield waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());
        // 9seg
        expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith({ dataSourceName: GRAFANA_RULES_SOURCE_NAME, apiVersion: 'legacy' }, 'Folder A', {
            interval: '1m',
            name: 'group1',
            rules: [
                {
                    annotations: { description: 'some description' },
                    labels: { severity: 'warn' },
                    for: '5m',
                    grafana_alert: {
                        condition: 'B',
                        data: getDefaultQueries(),
                        exec_err_state: GrafanaAlertStateDecision.Error,
                        is_paused: false,
                        no_data_state: 'NoData',
                        title: 'my great new rule',
                    },
                },
            ],
        });
    }));
});
//# sourceMappingURL=RuleEditorGrafanaRules.test.js.map