import { waitFor, screen, within, waitForElementToBeRemoved } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { byRole, byText } from 'testing-library-selector';

import { setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { PromApplication } from 'app/types/unified-alerting-dto';

import { searchFolders } from '../../manage-dashboards/state/actions';

import { discoverFeatures } from './api/buildInfo';
import { fetchRulerRules, fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup } from './api/ruler';
import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';
import { disableRBAC, mockDataSource, MockDataSourceSrv } from './mocks';
import { fetchRulerRulesIfNotFetchedYet } from './state/actions';
import * as config from './utils/config';

jest.mock('./components/rule-editor/ExpressionEditor', () => ({
  // eslint-disable-next-line react/display-name
  ExpressionEditor: ({ value, onChange }: ExpressionEditorProps) => (
    <input value={value} data-testid="expr" onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock('./api/buildInfo');
jest.mock('./api/ruler');
jest.mock('../../../../app/features/manage-dashboards/state/actions');

// there's no angular scope in test and things go terribly wrong when trying to render the query editor row.
// lets just skip it
jest.mock('app/features/query/components/QueryEditorRow', () => ({
  // eslint-disable-next-line react/display-name
  QueryEditorRow: () => <p>hi</p>,
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

const getLabelInput = (selector: HTMLElement) => within(selector).getByRole('combobox');

describe('RuleEditor recording rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
  });

  disableRBAC();
  it('can create a new cloud recording rule', async () => {
    const dataSources = {
      default: mockDataSource(
        {
          type: 'prometheus',
          name: 'Prom',
          isDefault: true,
        },
        { alerting: true }
      ),
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

    renderRuleEditor();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));
    await userEvent.type(await ui.inputs.name.find(), 'my great new recording rule');
    await userEvent.click(await ui.buttons.lotexRecordingRule.get());

    const dataSourceSelect = ui.inputs.dataSource.get();
    await userEvent.click(byRole('combobox').get(dataSourceSelect));

    await clickSelectOption(dataSourceSelect, 'Prom (default)');
    await clickSelectOption(ui.inputs.namespace.get(), 'namespace2');
    await clickSelectOption(ui.inputs.group.get(), 'group2');

    await userEvent.type(await ui.inputs.expr.find(), 'up == 1');

    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
    await userEvent.click(ui.buttons.addLabel.get(), { pointerEventsCheck: PointerEventsCheckLevel.Never });

    await userEvent.type(getLabelInput(ui.inputs.labelKey(1).get()), 'team{enter}');
    await userEvent.type(getLabelInput(ui.inputs.labelValue(1).get()), 'the a-team{enter}');

    // try to save, find out that recording rule name is invalid
    await userEvent.click(ui.buttons.save.get());
    await waitFor(() =>
      expect(
        byText(
          'Recording rule name must be valid metric name. It may only contain letters, numbers, and colons. It may not contain whitespace.'
        ).get()
      ).toBeInTheDocument()
    );
    expect(mocks.api.setRulerRuleGroup).not.toBeCalled();

    // fix name and re-submit
    await userEvent.clear(await ui.inputs.name.find());
    await userEvent.type(await ui.inputs.name.find(), 'my:great:new:recording:rule');

    // save and check what was sent to backend
    await userEvent.click(ui.buttons.save.get());
    await waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());
    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith(
      { dataSourceName: 'Prom', apiVersion: 'legacy' },
      'namespace2',
      {
        name: 'group2',
        rules: [
          {
            record: 'my:great:new:recording:rule',
            labels: { team: 'the a-team' },
            expr: 'up == 1',
          },
        ],
      }
    );
  });
});
