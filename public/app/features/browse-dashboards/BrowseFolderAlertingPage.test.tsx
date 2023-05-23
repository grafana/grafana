import 'whatwg-fetch'; // fetch polyfill
import { render as rtlRender, screen } from '@testing-library/react';
import { rest } from 'msw';
import { SetupServer, setupServer } from 'msw/node';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { contextSrv } from 'app/core/core';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import { backendSrv } from 'app/core/services/backend_srv';
import {
  GrafanaAlertStateDecision,
  PromAlertingRuleState,
  PromRulesResponse,
  PromRuleType,
  RulerRulesConfigDTO,
} from 'app/types/unified-alerting-dto';

import BrowseFolderAlertingPage, { OwnProps } from './BrowseFolderAlertingPage';

function render(...[ui, options]: Parameters<typeof rtlRender>) {
  rtlRender(<TestProvider>{ui}</TestProvider>, options);
}

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => backendSrv,
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    unifiedAlertingEnabled: true,
  },
}));

const mockFolderName = 'myFolder';
const mockFolderUid = '12345';
const mockAlertRuleName = 'myAlertRule';

const mockRulerRulesResponse: RulerRulesConfigDTO = {
  [mockFolderName]: [
    {
      name: 'foo',
      interval: '1m',
      rules: [
        {
          annotations: {},
          labels: {},
          expr: '',
          for: '5m',
          grafana_alert: {
            id: '49',
            title: mockAlertRuleName,
            condition: 'B',
            data: [
              {
                refId: 'A',
                queryType: '',
                relativeTimeRange: {
                  from: 600,
                  to: 0,
                },
                datasourceUid: 'gdev-testdata',
                model: {
                  hide: false,
                  intervalMs: 1000,
                  maxDataPoints: 43200,
                  refId: 'A',
                },
              },
            ],
            uid: 'eb8bc52a-9a1d-4100-a428-91b543c0e5ab',
            namespace_uid: mockFolderUid,
            namespace_id: 93,
            no_data_state: GrafanaAlertStateDecision.NoData,
            exec_err_state: GrafanaAlertStateDecision.Error,
            is_paused: false,
          },
        },
      ],
    },
  ],
};

const mockPrometheusRulesResponse: PromRulesResponse = {
  status: 'success',
  data: {
    groups: [
      {
        name: 'foo',
        file: mockFolderName,
        rules: [
          {
            alerts: [],
            labels: {},
            state: PromAlertingRuleState.Inactive,
            name: mockAlertRuleName,
            query:
              '[{"refId":"A","queryType":"","relativeTimeRange":{"from":600,"to":0},"datasourceUid":"gdev-testdata","model":{"hide":false,"intervalMs":1000,"maxDataPoints":43200,"refId":"A"}},{"refId":"B","queryType":"","relativeTimeRange":{"from":0,"to":0},"datasourceUid":"__expr__","model":{"conditions":[{"evaluator":{"params":[0,0],"type":"gt"},"operator":{"type":"and"},"query":{"params":[]},"reducer":{"params":[],"type":"avg"},"type":"query"}],"datasource":{"name":"Expression","type":"__expr__","uid":"__expr__"},"expression":"A","intervalMs":1000,"maxDataPoints":43200,"refId":"B","type":"threshold"}}]',
            duration: 300,
            health: 'ok',
            type: PromRuleType.Alerting,
            lastEvaluation: '0001-01-01T00:00:00Z',
            evaluationTime: 0,
          },
        ],
        interval: 60,
        lastEvaluation: '0001-01-01T00:00:00Z',
        evaluationTime: 0,
      },
    ],
    totals: {
      inactive: 1,
    },
  },
};

describe('browse-dashboards BrowseDashboardsPage', () => {
  let props: OwnProps;
  let server: SetupServer;

  beforeAll(() => {
    server = setupServer(
      rest.get('/api/folders/:uid', (_, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            title: mockFolderName,
            uid: mockFolderUid,
          })
        );
      }),
      rest.get('api/ruler/grafana/api/v1/rules', (_, res, ctx) => {
        return res(ctx.status(200), ctx.json<RulerRulesConfigDTO>(mockRulerRulesResponse));
      }),
      rest.get('api/prometheus/grafana/api/v1/rules', (_, res, ctx) => {
        return res(ctx.status(200), ctx.json<PromRulesResponse>(mockPrometheusRulesResponse));
      })
    );
    server.listen();
  });

  afterAll(() => {
    server.close();
  });

  beforeEach(() => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
    props = {
      ...getRouteComponentProps({
        match: {
          params: {
            uid: mockFolderUid,
          },
          isExact: false,
          path: '',
          url: '',
        },
      }),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
    server.resetHandlers();
  });

  it('displays the folder title', async () => {
    render(<BrowseFolderAlertingPage {...props} />);
    expect(await screen.findByRole('heading', { name: mockFolderName })).toBeInTheDocument();
  });

  it('displays the "Folder actions" button', async () => {
    render(<BrowseFolderAlertingPage {...props} />);
    expect(await screen.findByRole('button', { name: 'Folder actions' })).toBeInTheDocument();
  });

  it('displays all the folder tabs and shows the "Alert rules" tab as selected', async () => {
    render(<BrowseFolderAlertingPage {...props} />);
    expect(await screen.findByRole('tab', { name: 'Tab Dashboards' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Tab Dashboards' })).toHaveAttribute('aria-selected', 'false');

    expect(await screen.findByRole('tab', { name: 'Tab Panels' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Tab Panels' })).toHaveAttribute('aria-selected', 'false');

    expect(await screen.findByRole('tab', { name: 'Tab Alert rules' })).toBeInTheDocument();
    expect(await screen.findByRole('tab', { name: 'Tab Alert rules' })).toHaveAttribute('aria-selected', 'true');
  });

  it('displays the alert rules returned by the API', async () => {
    render(<BrowseFolderAlertingPage {...props} />);

    expect(await screen.findByRole('link', { name: mockAlertRuleName })).toBeInTheDocument();
  });
});
