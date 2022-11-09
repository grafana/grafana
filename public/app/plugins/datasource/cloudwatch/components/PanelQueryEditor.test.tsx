import { act, render, screen } from '@testing-library/react';
import React from 'react';

import { QueryEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
import {
  validLogsQuery,
  validMetricQueryBuilderQuery,
  validMetricQueryCodeQuery,
  validMetricSearchBuilderQuery,
  validMetricSearchCodeQuery,
} from '../__mocks__/queries';
import { CloudWatchDatasource } from '../datasource';
import { CloudWatchQuery, CloudWatchJsonData, MetricEditorMode, MetricQueryType } from '../types';

import { PanelQueryEditor } from './PanelQueryEditor';

// the following three fields are added to legacy queries in the dashboard migrator
const migratedFields = {
  statistic: 'Average',
  metricEditorMode: MetricEditorMode.Builder,
  metricQueryType: MetricQueryType.Query,
};

const props: QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> = {
  datasource: setupMockedDataSource().datasource,
  onRunQuery: jest.fn(),
  onChange: jest.fn(),
  query: {} as CloudWatchQuery,
};

describe('PanelQueryEditor should render right editor', () => {
  describe('when using grafana 6.3.0 metric query', () => {
    it('should render the metrics query editor', async () => {
      const query = {
        ...migratedFields,
        dimensions: {
          InstanceId: 'i-123',
        },
        expression: '',
        highResolution: false,
        id: '',
        metricName: 'CPUUtilization',
        namespace: 'AWS/EC2',
        period: '',
        refId: 'A',
        region: 'default',
        returnData: false,
      };
      await act(async () => {
        render(<PanelQueryEditor {...props} query={query} />);
      });
      expect(screen.getByText('Metric name')).toBeInTheDocument();
    });
  });

  describe('when using grafana 7.0.0 style metrics query', () => {
    it('should render the metrics query editor', async () => {
      const query = {
        ...migratedFields,
        alias: '',
        apiMode: 'Logs',
        dimensions: {
          InstanceId: 'i-123',
        },
        expression: '',
        id: '',
        logGroupNames: [],
        matchExact: true,
        metricName: 'CPUUtilization',
        namespace: 'AWS/EC2',
        period: '',
        queryMode: 'Logs',
        refId: 'A',
        region: 'ap-northeast-2',
        statistics: 'Average',
      } as any;
      await act(async () => {
        render(<PanelQueryEditor {...props} query={query} />);
      });
      expect(screen.getByText('Choose Log Groups')).toBeInTheDocument();
    });
  });

  describe('when using grafana 7.0.0 style logs query', () => {
    it('should render the metrics query editor', async () => {
      const query = {
        ...migratedFields,
        alias: '',
        apiMode: 'Logs',
        dimensions: {
          InstanceId: 'i-123',
        },
        expression: '',
        id: '',
        logGroupNames: [],
        matchExact: true,
        metricName: 'CPUUtilization',
        namespace: 'AWS/EC2',
        period: '',
        queryMode: 'Logs',
        refId: 'A',
        region: 'ap-northeast-2',
        statistic: 'Average',
      } as any;
      await act(async () => {
        render(<PanelQueryEditor {...props} query={query} />);
      });
      expect(screen.getByText('Log Groups')).toBeInTheDocument();
    });
  });

  describe('when using grafana query from curated ec2 dashboard', () => {
    it('should render the metrics query editor', async () => {
      const query = {
        ...migratedFields,

        alias: 'Inbound',
        dimensions: {
          InstanceId: '*',
        },
        expression:
          "SUM(REMOVE_EMPTY(SEARCH('{AWS/EC2,InstanceId} MetricName=\"NetworkIn\"', 'Sum', $period)))/$period",
        id: '',
        matchExact: true,
        metricName: 'NetworkOut',
        namespace: 'AWS/EC2',
        period: '$period',
        refId: 'B',
        region: '$region',
        statistic: 'Average',
      } as any;
      await act(async () => {
        render(<PanelQueryEditor {...props} query={query} />);
      });
      expect(screen.getByText('Metric name')).toBeInTheDocument();
    });
  });

  interface MonitoringBadgeScenario {
    name: string;
    query: CloudWatchQuery;
    toggle: boolean;
  }

  describe('monitoring badge', () => {
    let originalValue: boolean | undefined;
    let datasourceMock: ReturnType<typeof setupMockedDataSource>;
    beforeEach(() => {
      datasourceMock = setupMockedDataSource();
      datasourceMock.datasource.api.isMonitoringAccount = jest.fn().mockResolvedValue(true);
      datasourceMock.datasource.api.getMetrics = jest.fn().mockResolvedValue([]);
      datasourceMock.datasource.api.getDimensionKeys = jest.fn().mockResolvedValue([]);
      originalValue = config.featureToggles.cloudWatchCrossAccountQuerying;
    });
    afterEach(() => {
      config.featureToggles.cloudWatchCrossAccountQuerying = originalValue;
    });

    describe('should be displayed when a monitoring account is returned and', () => {
      const cases: MonitoringBadgeScenario[] = [
        { name: 'it is logs query and feature is enabled', query: validLogsQuery, toggle: true },
        {
          name: 'it is metric search builder query and feature is enabled',
          query: validMetricSearchBuilderQuery,
          toggle: true,
        },
        {
          name: 'it is metric search code query and feature is enabled',
          query: validMetricSearchCodeQuery,
          toggle: true,
        },
      ];

      test.each(cases)('$name', async ({ query, toggle }) => {
        config.featureToggles.cloudWatchCrossAccountQuerying = toggle;
        await act(async () => {
          render(<PanelQueryEditor {...props} datasource={datasourceMock.datasource} query={query} />);
        });
        expect(await screen.getByText('Monitoring account')).toBeInTheDocument();
      });
    });

    describe('should not be displayed when a monitoring account is returned and', () => {
      const cases: MonitoringBadgeScenario[] = [
        {
          name: 'it is metric query builder query and toggle is enabled',
          query: validMetricQueryBuilderQuery,
          toggle: true,
        },
        {
          name: 'it is metric query code query and toggle is not enabled',
          query: validMetricQueryCodeQuery,
          toggle: true,
        },
        { name: 'it is logs query and feature is not enabled', query: validLogsQuery, toggle: false },
        {
          name: 'it is metric search builder query and feature is not enabled',
          query: validMetricSearchBuilderQuery,
          toggle: false,
        },
        {
          name: 'it is metric search code query and feature is not enabled',
          query: validMetricSearchCodeQuery,
          toggle: false,
        },
      ];
      test.each(cases)('$name', async ({ query, toggle }) => {
        config.featureToggles.cloudWatchCrossAccountQuerying = toggle;
        await act(async () => {
          render(<PanelQueryEditor {...props} datasource={datasourceMock.datasource} query={query} />);
        });
        expect(await screen.queryByText('Monitoring account')).toBeNull();
      });
    });
  });
});
