import { render, screen } from '@testing-library/react';
import selectEvent from 'react-select-event';

import { CustomVariableModel, DataSourceInstanceSettings } from '@grafana/data';
import * as ui from '@grafana/ui';

import { setupMockedTemplateService } from '../../../__mocks__/CloudWatchDataSource';
import { initialVariableModelState } from '../../../__mocks__/CloudWatchVariables';
import { CloudWatchDatasource } from '../../../datasource';
import { CloudWatchJsonData, MetricEditorMode, MetricQueryType } from '../../../types';

import { MetricsQueryEditor, Props } from './MetricsQueryEditor';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual<typeof ui>('@grafana/ui'),
  CodeEditor: function CodeEditor({ value }: { value: string }) {
    return <pre>{value}</pre>;
  },
}));

const setup = () => {
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
  datasource.resources.isMonitoringAccount = jest.fn().mockResolvedValue(false);

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
});
