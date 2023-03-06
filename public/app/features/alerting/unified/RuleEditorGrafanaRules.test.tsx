import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import React from 'react';
import { renderRuleEditor, ui } from 'test/helpers/alertingRuleEditor';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';
import { byRole } from 'testing-library-selector';

import { setDataSourceSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { DashboardSearchHit } from 'app/features/search/types';
import { GrafanaAlertStateDecision, PromApplication } from 'app/types/unified-alerting-dto';

import { searchFolders } from '../../../../app/features/manage-dashboards/state/actions';

import { discoverFeatures } from './api/buildInfo';
import { fetchRulerRules, fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup } from './api/ruler';
import { ExpressionEditorProps } from './components/rule-editor/ExpressionEditor';
import { disableRBAC, mockDataSource, MockDataSourceSrv } from './mocks';
import { fetchRulerRulesIfNotFetchedYet } from './state/actions';
import * as config from './utils/config';
import { GRAFANA_RULES_SOURCE_NAME } from './utils/datasource';

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
describe('RuleEditor grafana managed rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contextSrv.isEditor = true;
    contextSrv.hasEditPermissionInFolders = true;
  });

  disableRBAC();

  it('can create new grafana managed alert', async () => {
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

    const dsServer = new MockDataSourceSrv(dataSources);
    jest.spyOn(dsServer, 'get').mockResolvedValue(new MockDataSourceApi('ds'));

    setDataSourceSrv(dsServer);
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
    ] as DashboardSearchHit[]);

    mocks.api.discoverFeatures.mockResolvedValue({
      application: PromApplication.Prometheus,
      features: {
        rulerApiEnabled: false,
      },
    });

    renderRuleEditor();
    await waitForElementToBeRemoved(screen.getAllByTestId('Spinner'));

    await userEvent.type(await ui.inputs.name.find(), 'my great new rule');

    const folderInput = await ui.inputs.folder.find();
    await clickSelectOption(folderInput, 'Folder A');
    const groupInput = await ui.inputs.group.find();
    await userEvent.click(byRole('combobox').get(groupInput));
    await clickSelectOption(groupInput, 'group1');
    await userEvent.type(ui.inputs.annotationValue(1).get(), 'some description');

    // TODO remove skipPointerEventsCheck once https://github.com/jsdom/jsdom/issues/3232 is fixed
    await userEvent.click(ui.buttons.addLabel.get(), { pointerEventsCheck: PointerEventsCheckLevel.Never });

    await userEvent.type(getLabelInput(ui.inputs.labelKey(0).get()), 'severity{enter}');
    await userEvent.type(getLabelInput(ui.inputs.labelValue(0).get()), 'warn{enter}');
    //8 segons

    // save and check what was sent to backend
    await userEvent.click(ui.buttons.save.get());

    // 9seg
    await waitFor(() => expect(mocks.api.setRulerRuleGroup).toHaveBeenCalled());
    // 9seg
    expect(mocks.api.setRulerRuleGroup).toHaveBeenCalledWith(
      { dataSourceName: GRAFANA_RULES_SOURCE_NAME, apiVersion: 'legacy' },
      'Folder A',
      {
        name: 'group1',
        interval: '1m',
        rules: [
          {
            grafana_alert: {
              title: 'my great new rule',
              condition: 'C',
              no_data_state: 'NoData',
              exec_err_state: GrafanaAlertStateDecision.Error,
              data: [
                {
                  refId: 'A',
                  relativeTimeRange: {
                    from: 600,
                    to: 0,
                  },
                  datasourceUid: 'mock-ds-2',
                  model: {
                    hide: false,
                    refId: 'A',
                  },
                  queryType: '',
                },
                {
                  refId: 'B',
                  datasourceUid: '__expr__',
                  queryType: '',
                  model: {
                    refId: 'B',
                    hide: false,
                    type: 'reduce',
                    datasource: {
                      uid: '__expr__',
                      type: '__expr__',
                    },
                    conditions: [
                      {
                        type: 'query',
                        evaluator: {
                          params: [],
                          type: 'gt',
                        },
                        operator: {
                          type: 'and',
                        },
                        query: {
                          params: ['B'],
                        },
                        reducer: {
                          params: [],
                          type: 'last',
                        },
                      },
                    ],
                    reducer: 'last',
                    expression: 'A',
                  },
                },
                {
                  refId: 'C',
                  datasourceUid: '__expr__',
                  queryType: '',
                  model: {
                    refId: 'C',
                    hide: false,
                    type: 'threshold',
                    datasource: {
                      uid: '__expr__',
                      type: '__expr__',
                    },
                    conditions: [
                      {
                        type: 'query',
                        evaluator: {
                          params: [0],
                          type: 'gt',
                        },
                        operator: {
                          type: 'and',
                        },
                        query: {
                          params: ['C'],
                        },
                        reducer: {
                          params: [],
                          type: 'last',
                        },
                      },
                    ],
                    expression: 'B',
                  },
                },
              ],
              is_paused: false,
            },
            for: '5m',
            annotations: {
              description: 'some description',
            },
            labels: {
              severity: 'warn',
            },
          },
        ],
      }
    );
  });
});
