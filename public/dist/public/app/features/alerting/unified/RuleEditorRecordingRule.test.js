import { __awaiter } from "tslib";
import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byRole, byText } from 'testing-library-selector';
import { setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types';
import { PromApplication } from 'app/types/unified-alerting-dto';
import { searchFolders } from '../../manage-dashboards/state/actions';
import { discoverFeatures } from './api/buildInfo';
import { fetchRulerRules, fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup } from './api/ruler';
import { grantUserPermissions, mockDataSource, MockDataSourceSrv } from './mocks';
import { fetchRulerRulesIfNotFetchedYet } from './state/actions';
import * as config from './utils/config';
jest.mock('./components/rule-editor/RecordingRuleEditor', () => ({
    RecordingRuleEditor: ({ queries, onChangeQuery }) => {
        const onChange = (expr) => {
            const query = queries[0];
            const merged = Object.assign(Object.assign({}, query), { expr, model: Object.assign(Object.assign({}, query.model), { expr }) });
            onChangeQuery([merged]);
        };
        return React.createElement("input", { "data-testid": "expr", onChange: (e) => onChange(e.target.value) });
    },
}));
jest.mock('app/core/components/AppChrome/AppChromeUpdate', () => ({
    AppChromeUpdate: ({ actions }) => React.createElement("div", null, actions),
}));
jest.mock('./api/buildInfo');
jest.mock('./api/ruler');
jest.mock('../../../../app/features/manage-dashboards/state/actions');
// there's no angular scope in test and things go terribly wrong when trying to render the query editor row.
// lets just skip it
jest.mock('app/features/query/components/QueryEditorRow', () => ({
    // eslint-disable-next-line react/display-name
    QueryEditorRow: () => React.createElement("p", null, "hi"),
}));
jest.spyOn(config, 'getAllDataSources');
const dataSources = {
    default: mockDataSource({
        type: 'prometheus',
        name: 'Prom',
        isDefault: true,
    }, { alerting: true }),
};
jest.mock('@grafana/runtime', () => (Object.assign(Object.assign({}, jest.requireActual('@grafana/runtime')), { getDataSourceSrv: jest.fn(() => ({
        getInstanceSettings: () => dataSources.default,
        get: () => dataSources.default,
    })) })));
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
describe('RuleEditor recording rules', () => {
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
    it('can create a new cloud recording rule', () => __awaiter(void 0, void 0, void 0, function* () {
        setDataSourceSrv(new MockDataSourceSrv(dataSources));
        mocks.getAllDataSources.mockReturnValue(Object.values(dataSources));
        mocks.api.setRulerRuleGroup.mockResolvedValue();
        mocks.api.fetchRulerRulesNamespace.mockResolvedValue([]);
        mocks.api.fetchRulerRulesGroup.mockResolvedValue({
            name: 'group2',
            rules: [],
        });
        mocks.api.fetchRulerRules.mockResolvedValue({
            namespace1: [
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
        mocks.searchFolders.mockResolvedValue([]);
        mocks.api.discoverFeatures.mockResolvedValue({
            application: PromApplication.Cortex,
            features: {
                rulerApiEnabled: true,
            },
        });
        renderRuleEditor(undefined, true);
        yield waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));
        yield userEvent.type(yield ui.inputs.name.find(), 'my great new recording rule');
        const dataSourceSelect = ui.inputs.dataSource.get();
        yield userEvent.click(byRole('combobox').get(dataSourceSelect));
        yield clickSelectOption(dataSourceSelect, 'Prom (default)');
        yield clickSelectOption(ui.inputs.namespace.get(), 'namespace2');
        yield clickSelectOption(ui.inputs.group.get(), 'group2');
        yield userEvent.type(yield ui.inputs.expr.find(), 'up == 1');
        // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
        yield userEvent.click(ui.buttons.addLabel.get(), { pointerEventsCheck: PointerEventsCheckLevel.Never });
        yield userEvent.type(getLabelInput(ui.inputs.labelKey(1).get()), 'team{enter}');
        yield userEvent.type(getLabelInput(ui.inputs.labelValue(1).get()), 'the a-team{enter}');
        // try to save, find out that recording rule name is invalid
        yield userEvent.click(ui.buttons.saveAndExit.get());
        yield waitFor(() => expect(byText('Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.').get()).toBeInTheDocument());
        expect(mocks.api.setRulerRuleGroup).not.toBeCalled();
        // fix name and re-submit
        yield userEvent.clear(yield ui.inputs.name.find());
        yield userEvent.type(yield ui.inputs.name.find(), 'my:great:new:recording:rule');
        // save and check what was sent to backend
        yield userEvent.click(ui.buttons.saveAndExit.get());
        yield waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());
        expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith({ dataSourceName: 'Prom', apiVersion: 'legacy' }, 'namespace2', {
            name: 'group2',
            rules: [
                {
                    record: 'my:great:new:recording:rule',
                    labels: { team: 'the a-team' },
                    expr: 'up == 1',
                },
            ],
        });
    }));
});
//# sourceMappingURL=RuleEditorRecordingRule.test.js.map