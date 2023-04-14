import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import React from 'react';
import { DeepPartial } from 'react-hook-form';
import { TestProvider } from 'test/helpers/TestProvider';

import { DataSourcePluginMeta } from '@grafana/data';
import * as runtime from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import 'whatwg-fetch';

import { EmptyStateNoDatasource } from './EmptyStateNoDatasource';

let reportInteractionSpy: jest.SpyInstance;
const server = setupServer();

beforeEach(() => {
  jest.spyOn(contextSrv, 'hasRole').mockReturnValue(true);
  reportInteractionSpy = jest.spyOn(runtime, 'reportInteraction');
  server.resetHandlers();
});

afterEach(() => {
  jest.restoreAllMocks();
});

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterAll(() => {
  server.close();
});

describe('EmptyStateNoDatasource', () => {
  it('correctly tracks user interactions', async () => {
    server.use(
      rest.get('/api/plugins', (_, res, ctx) => {
        return res(
          ctx.json<Array<DeepPartial<DataSourcePluginMeta>>>([
            { id: 'prometheus', name: 'Prometheus', info: { logos: { small: 'prometheus.png' } } },
            { id: 'mysql', name: 'MySQL', info: { logos: { small: 'mysql.png' } } },
            { id: 'elasticsearch', name: 'Elasticsearch', info: { logos: { small: 'elasticsearch.png' } } },
            { id: 'influxdb', name: 'InfluxDB', info: { logos: { small: 'influxdb.png' } } },
            { id: 'graphite', name: 'Graphite', info: { logos: { small: 'graphite.png' } } },
            { id: 'stackdriver', name: 'StackDriver', info: { logos: { small: 'stackdriver.png' } } },
            { id: 'cloudwatch', name: 'CloudWatch', info: { logos: { small: 'cloudwatch.png' } } },
            {
              id: 'grafana-azure-monitor-datasource',
              name: 'Azure Monitor',
              info: { logos: { small: 'grafana-azure-monitor-datasource.png' } },
            },
          ])
        );
      })
    );
    render(
      <TestProvider>
        <EmptyStateNoDatasource title="A Title" CTAText="CTA" />
      </TestProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'A Title' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Prometheus' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Prometheus' }));
    expect(reportInteractionSpy).toHaveBeenLastCalledWith('dashboards_connectds_ds_clicked');

    fireEvent.click(screen.getByRole('link', { name: 'View all' }));
    expect(reportInteractionSpy).toHaveBeenCalledWith('dashboards_connectds_viewall_clicked');

    fireEvent.click(screen.getByRole('button', { name: 'CTA' }));
    expect(reportInteractionSpy).toHaveBeenLastCalledWith('dashboards_connectds_sampledata_clicked');
  });
});
