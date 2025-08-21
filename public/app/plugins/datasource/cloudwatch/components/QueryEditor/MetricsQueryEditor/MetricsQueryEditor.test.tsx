import { render, screen, waitFor } from '@testing-library/react';
import selectEvent from 'react-select-event';

import { CustomVariableModel, DataSourceInstanceSettings } from '@grafana/data';
// eslint-ignore-next-line
import * as ui from '@grafana/ui';

import { CloudWatchDatasource } from '../../../datasource';
import { setupMockedTemplateService } from '../../../mocks/CloudWatchDataSource';
import { initialVariableModelState } from '../../../mocks/CloudWatchVariables';
import { CloudWatchJsonData, CloudWatchMetricsQuery, MetricEditorMode, MetricQueryType } from '../../../types';

import { MetricsQueryEditor, Props } from './MetricsQueryEditor';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual<typeof ui>('@grafana/ui'),
  CodeEditor: function CodeEditor({ value }: { value: string }) {
    return <pre>{value}</pre>;
  },
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual<typeof import('@grafana/runtime')>('@grafana/runtime'),
  config: {
    featureToggles: {
      cloudWatchCrossAccountQuerying: true,
    },
  },
}));

const setup = (customQuery?: Partial<CloudWatchMetricsQuery>, isMonitoringAccount?: boolean) => {
  const instanceSettings = {
    jsonData: { defaultRegion: 'us-east-1' },
  } as DataSourceInstanceSettings<CloudWatchJsonData>;

  const variable: CustomVariableModel = {
    ...initialVariableModelState,
    id: 'var3',
    index: 0,
    name: 'var3',
    options: [
      { selected: true, value: 'var3-foo', text: 'var3-foo' },
      { selected: false, value: 'var3-bar', text: 'var3-bar' },
      { selected: true, value: 'var3-baz', text: 'var3-baz' },
    ],
    current: { selected: true, value: ['var3-foo', 'var3-baz'], text: 'var3-foo + var3-baz' },
    multi: true,
    includeAll: false,
    query: '',
    type: 'custom',
  };
  const templateSrv = setupMockedTemplateService([variable]);

  const datasource = new CloudWatchDatasource(instanceSettings, templateSrv);
  datasource.metricFindQuery = async () => [{ value: 'test', label: 'test', text: 'test' }];
  datasource.resources.getNamespaces = jest.fn().mockResolvedValue([]);
  datasource.resources.getMetrics = jest.fn().mockResolvedValue([]);
  datasource.resources.getRegions = jest.fn().mockResolvedValue([]);
  datasource.resources.getDimensionKeys = jest.fn().mockResolvedValue([]);
  datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(isMonitoringAccount ?? false);

  const props: Props = {
    query: {
      queryMode: 'Metrics',
      refId: '',
      id: '',
      region: 'us-east-1',
      namespace: 'ec2',
      metricName: 'CPUUtilization',
      dimensions: { somekey: 'somevalue' },
      statistic: '',
      period: '',
      expression: '',
      alias: '',
      matchExact: true,
      metricQueryType: MetricQueryType.Search,
      metricEditorMode: MetricEditorMode.Builder,
      ...customQuery,
    },
    extraHeaderElementLeft: () => {},
    extraHeaderElementRight: () => {},
    datasource,
    history: [],
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
  };

  return props;
};

describe('QueryEditor', () => {
  describe('should handle expression options correctly', () => {
    it('should display match exact switch', async () => {
      const props = setup();
      render(<MetricsQueryEditor {...props} />);
      expect(await screen.findByText('Match exact')).toBeInTheDocument();
    });

    it('should display wildcard option in dimension value dropdown', async () => {
      const props = setup();
      if (props.query.queryMode !== 'Metrics') {
        fail(`expected props.query.queryMode to be 'Metrics', got '${props.query.queryMode}' instead`);
      }
      props.datasource.resources.getDimensionValues = jest
        .fn()
        .mockResolvedValue([[{ label: 'dimVal1', value: 'dimVal1' }]]);
      props.query.metricQueryType = MetricQueryType.Search;
      props.query.metricEditorMode = MetricEditorMode.Builder;
      props.query.dimensions = { instanceId: 'instance-123' };

      render(<MetricsQueryEditor {...props} />);

      expect(screen.getByText('Match exact')).toBeInTheDocument();
      expect(screen.getByText('instance-123')).toBeInTheDocument();
      expect(screen.queryByText('*')).toBeNull();
      selectEvent.openMenu(screen.getByLabelText('Dimensions filter value'));
      expect(await screen.findByText('*')).toBeInTheDocument();
    });
  });

  it('should render label field and not alias field', async () => {
    const props = setup();

    render(
      <MetricsQueryEditor
        {...props}
        query={{ ...props.query, refId: 'A', alias: 'Period: {{period}} InstanceId: {{InstanceId}}' }}
      />
    );

    expect(await screen.findByText('Label')).toBeInTheDocument();
    expect(screen.queryByText('Alias')).toBeNull();
    expect(screen.getByText("Period: ${PROP('Period')} InstanceId: ${PROP('Dim.InstanceId')}"));
  });

  it('should clear accountId field when datasource connects to a non-monitoring account', async () => {
    const props = setup({ accountId: '123456789' });

    render(<MetricsQueryEditor {...props} />);

    expect(props.datasource.resources.isMonitoringAccount).toHaveBeenCalledWith('us-east-1');
    await waitFor(async () => {
      expect(props.onChange).toHaveBeenCalledWith({
        ...props.query,
        accountId: undefined,
      });
    });
  });
  it('should keep accountId field when datasource connects to a monitoring account', async () => {
    const props = setup({ accountId: '123456789' }, true);

    render(<MetricsQueryEditor {...props} />);

    expect(props.datasource.resources.isMonitoringAccount).toHaveBeenCalledWith('us-east-1');
    await waitFor(async () => {
      expect(props.onChange).not.toHaveBeenCalledWith({
        ...props.query,
        accountId: undefined,
      });
    });
  });
});
