import { act, render, screen } from '@testing-library/react';
import React from 'react';

import { QueryEditorProps } from '@grafana/data';

import { setupMockedDataSource } from '../__mocks__/CloudWatchDataSource';
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
});
