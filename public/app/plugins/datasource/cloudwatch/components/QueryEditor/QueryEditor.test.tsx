import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { QueryEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';

import { setupMockedDataSource } from '../../__mocks__/CloudWatchDataSource';
import {
  validLogsQuery,
  validMetricQueryBuilderQuery,
  validMetricQueryCodeQuery,
  validMetricSearchBuilderQuery,
  validMetricSearchCodeQuery,
} from '../../__mocks__/queries';
import { CloudWatchDatasource } from '../../datasource';
import { DEFAULT_CWLI_QUERY_STRING, DEFAULT_SQL_QUERY_STRING } from '../../defaultQueries';
import { CloudWatchQuery, CloudWatchJsonData, MetricEditorMode, MetricQueryType, LogsQueryLanguage } from '../../types';

import { QueryEditor } from './QueryEditor';

// the following three fields are added to legacy queries in the dashboard migrator
const migratedFields = {
  statistic: 'Average',
  metricEditorMode: MetricEditorMode.Builder,
  metricQueryType: MetricQueryType.Insights,
};
const mockOnChange = jest.fn();
const props: QueryEditorProps<CloudWatchDatasource, CloudWatchQuery, CloudWatchJsonData> = {
  datasource: setupMockedDataSource().datasource,
  onRunQuery: jest.fn(),
  onChange: mockOnChange,
  query: {} as CloudWatchQuery,
};

const FAKE_EDITOR_LABEL = 'FakeEditor';

jest.mock('./MetricsQueryEditor/SQLCodeEditor', () => ({
  SQLCodeEditor: ({ sql, onChange }: { sql: string; onChange: (val: string) => void }) => {
    return (
      <>
        <label htmlFor="cloudwatch-fake-editor">{FAKE_EDITOR_LABEL}</label>
        <input id="cloudwatch-fake-editor" value={sql} onChange={(e) => onChange(e.currentTarget.value)}></input>
      </>
    );
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  config: {
    ...jest.requireActual('@grafana/runtime').config,
    featureToggles: {
      cloudWatchCrossAccountQuerying: true,
    },
  },
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  CodeEditor: jest.fn().mockImplementation(() => {
    return <input id="cloudwatch-fake-editor"></input>;
  }),
}));

export { SQLCodeEditor } from './MetricsQueryEditor/SQLCodeEditor';

describe('QueryEditor should render right editor', () => {
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
      render(<QueryEditor {...props} query={query} />);
      expect(await screen.findByText('Metric name')).toBeInTheDocument();
    });
  });

  describe('when using grafana 7.0.0 style metrics query', () => {
    it('should render the metrics query editor', async () => {
      const query = {
        ...migratedFields,
        alias: '',
        apiMode: 'Metrics',
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
        queryMode: 'Metrics',
        refId: 'A',
        region: 'ap-northeast-2',
        statistics: 'Average',
      } as CloudWatchQuery;
      render(<QueryEditor {...props} query={query} />);
      expect(await screen.findByText('Metric name')).toBeInTheDocument();
    });
  });

  describe('when using grafana 7.0.0 style logs query', () => {
    it('should render the logs query editor', async () => {
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
      } as CloudWatchQuery;
      render(<QueryEditor {...props} query={query} />);
      expect(await screen.findByText('Select log groups')).toBeInTheDocument();
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
      } as CloudWatchQuery;
      render(<QueryEditor {...props} query={query} />);
      expect(await screen.findByText('Metric name')).toBeInTheDocument();
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
      datasourceMock.datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(true);
      datasourceMock.datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
      datasourceMock.datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
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
        render(<QueryEditor {...props} datasource={datasourceMock.datasource} query={query} />);
        expect(await screen.findByText('Monitoring account')).toBeInTheDocument();
      });
    });

    describe('should not be displayed when a monitoring account is returned and', () => {
      const cases: MonitoringBadgeScenario[] = [
        {
          name: 'it is metric insights code query and toggle is not enabled',
          query: validMetricQueryCodeQuery,
          toggle: false,
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
        render(<QueryEditor {...props} datasource={datasourceMock.datasource} query={query} />);
        expect(await screen.findByText('Run queries')).toBeInTheDocument();
        expect(screen.queryByText('Monitoring account')).toBeNull();
      });
    });
  });

  describe('QueryHeader', () => {
    it('should display metric actions in header when metric insights is used', async () => {
      render(<QueryEditor {...props} query={validMetricQueryCodeQuery} />);

      expect(await screen.findByText('CloudWatch Metrics')).toBeInTheDocument();
      expect(screen.getByLabelText(/Region.*/)).toBeInTheDocument();
      expect(screen.getByLabelText('Builder')).toBeInTheDocument();
      expect(screen.getByLabelText('Code')).toBeInTheDocument();
      expect(screen.getByText('Metric Insights')).toBeInTheDocument();
    });

    it('should display metric actions in header when metric insights is used', async () => {
      render(<QueryEditor {...props} query={validLogsQuery} />);

      expect(await screen.findByText('CloudWatch Logs')).toBeInTheDocument();
      expect(screen.getByLabelText(/Region.*/)).toBeInTheDocument();
      expect(screen.queryByLabelText('Builder')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Code')).not.toBeInTheDocument();
      expect(screen.queryByText('Metric Insights')).not.toBeInTheDocument();
    });
  });

  describe('metrics editor should handle editor modes correctly', () => {
    it('when metric query type is metric search and editor mode is builder', async () => {
      render(<QueryEditor {...props} query={validMetricSearchBuilderQuery} />);

      expect(await screen.findByText('Metric Search')).toBeInTheDocument();
      const radio = screen.getByLabelText('Builder');
      expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
    });

    it('when metric query type is metric search and editor mode is raw', async () => {
      render(<QueryEditor {...props} query={validMetricSearchCodeQuery} />);

      expect(await screen.findByText('Metric Search')).toBeInTheDocument();
      const radio = screen.getByLabelText('Code');
      expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
    });

    it('when metric query type is metric insights and editor mode is builder', async () => {
      render(<QueryEditor {...props} query={validMetricQueryBuilderQuery} />);

      expect(await screen.findByText('Metric Insights')).toBeInTheDocument();
      const radio = screen.getByLabelText('Builder');
      expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
    });

    it('when metric query type is metric Insights and editor mode is raw', async () => {
      render(<QueryEditor {...props} query={validMetricQueryCodeQuery} />);

      expect(await screen.findByText('Metric Insights')).toBeInTheDocument();
      const radio = screen.getByLabelText('Code');
      expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
    });
  });

  describe('confirm modal', () => {
    it('should be shown when moving from code editor to builder when in sql mode', async () => {
      const sqlQuery = 'SELECT * FROM test';
      render(
        <QueryEditor
          {...props}
          query={{ ...validMetricQueryCodeQuery, sqlExpression: sqlQuery }}
          onChange={jest.fn()}
          onRunQuery={jest.fn()}
        />
      );

      // the modal should not be shown unless the code editor is "dirty", so need to trigger a change
      const codeEditorElement = screen.getByLabelText(FAKE_EDITOR_LABEL);
      await userEvent.clear(codeEditorElement);
      await userEvent.type(codeEditorElement, 'select * from ');
      const builderElement = screen.getByLabelText('Builder');
      expect(builderElement).toBeInTheDocument();
      await userEvent.click(builderElement);

      const modalTitleElem = screen.getByText('Are you sure?');
      expect(modalTitleElem).toBeInTheDocument();
    });

    it('should not be shown when moving from builder to code when in sql mode', async () => {
      render(
        <QueryEditor {...props} query={validMetricQueryBuilderQuery} onChange={jest.fn()} onRunQuery={jest.fn()} />
      );
      const builderElement = screen.getByLabelText('Builder');
      expect(builderElement).toBeInTheDocument();
      await userEvent.click(builderElement);
      expect(screen.queryByText('Are you sure?')).toBeNull();
    });

    it('should not be shown when moving from code to builder when in search mode', async () => {
      render(<QueryEditor {...props} query={validMetricSearchCodeQuery} onChange={jest.fn()} onRunQuery={jest.fn()} />);

      const builderElement = screen.getByLabelText('Builder');
      expect(builderElement).toBeInTheDocument();
      await userEvent.click(builderElement);
      expect(screen.queryByText('Are you sure?')).toBeNull();
    });
  });

  describe('metric insights in builder mode', () => {
    let originalValueCloudWatchCrossAccountQuerying: boolean | undefined;
    beforeEach(() => {
      originalValueCloudWatchCrossAccountQuerying = config.featureToggles.cloudWatchCrossAccountQuerying;
    });
    afterEach(() => {
      config.featureToggles.cloudWatchCrossAccountQuerying = originalValueCloudWatchCrossAccountQuerying;
    });
    it('should have an account selector when the feature is enabled', async () => {
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
      props.datasource.resources.getAccounts = jest.fn().mockResolvedValue(['account123']);
      render(<QueryEditor {...props} query={validMetricQueryBuilderQuery} />);
      await screen.findByText('Metric Insights');
      expect(await screen.findByText('Account')).toBeInTheDocument();
    });
  });
});
describe('LogsQueryEditor', () => {
  const logsProps = {
    ...props,
    datasource: setupMockedDataSource().datasource,
    query: validLogsQuery,
  };
  describe('setting default query', () => {
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should set default query expression if query is empty', async () => {
      const emptyQuery = { ...logsProps.query, expression: '' };
      render(<QueryEditor {...logsProps} query={emptyQuery} />);
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenLastCalledWith({
          ...logsProps.query,
          expression: DEFAULT_CWLI_QUERY_STRING,
        });
      });
    });
    it('should not change the query expression if not empty', async () => {
      const nonEmptyQuery = { ...logsProps.query, expression: 'some expression' };
      render(<QueryEditor {...logsProps} query={nonEmptyQuery} />);
      await waitFor(() => {
        expect(mockOnChange).not.toHaveBeenCalled();
      });
    });
    it('should set the correct default expression if query is new', async () => {
      const emptyQuery = { ...logsProps.query, expression: '' };
      render(<QueryEditor {...logsProps} query={emptyQuery} />);
      await selectOptionInTest(screen.getByLabelText(/Query language/), 'OpenSearch SQL');
      expect(mockOnChange).toHaveBeenCalledWith({
        ...logsProps.query,
        queryLanguage: LogsQueryLanguage.SQL,
        expression: DEFAULT_SQL_QUERY_STRING,
      });
    });
  });
});
