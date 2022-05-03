import { render, screen, act } from '@testing-library/react';
import React from 'react';
import selectEvent from 'react-select-event';
import renderer from 'react-test-renderer';

import { DataSourceInstanceSettings } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { CustomVariableModel, initialVariableModelState } from '../../../../features/variables/types';
import { CloudWatchDatasource } from '../datasource';
import { CloudWatchJsonData, MetricEditorMode, MetricQueryType } from '../types';

import { MetricsQueryEditor, Props } from './MetricsQueryEditor';

const setup = () => {
  const instanceSettings = {
    jsonData: { defaultRegion: 'us-east-1' },
  } as DataSourceInstanceSettings<CloudWatchJsonData>;

  const templateSrv = new TemplateSrv();
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
  templateSrv.init([variable]);

  const datasource = new CloudWatchDatasource(instanceSettings, templateSrv as any, {} as any);
  datasource.metricFindQuery = async () => [{ value: 'test', label: 'test', text: 'test' }];
  datasource.getNamespaces = jest.fn().mockResolvedValue([]);
  datasource.getMetrics = jest.fn().mockResolvedValue([]);
  datasource.getRegions = jest.fn().mockResolvedValue([]);
  datasource.getDimensionKeys = jest.fn().mockResolvedValue([]);

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
    datasource,
    history: [],
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
  };

  return props;
};

describe('QueryEditor', () => {
  it('should render component', async () => {
    const { act } = renderer;
    await act(async () => {
      const props = setup();
      const tree = renderer.create(<MetricsQueryEditor {...props} />).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });

  describe('should handle editor modes correctly', () => {
    it('when metric query type is metric search and editor mode is builder', async () => {
      await act(async () => {
        const props = setup();
        render(<MetricsQueryEditor {...props} />);

        expect(screen.getByText('Metric Search')).toBeInTheDocument();
        const radio = screen.getByLabelText('Builder');
        expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
      });
    });

    it('when metric query type is metric search and editor mode is raw', async () => {
      await act(async () => {
        const props = setup();
        if (props.query.queryMode !== 'Metrics') {
          fail(`expected props.query.queryMode to be 'Metrics', got '${props.query.queryMode}' instead`);
        }
        props.query.metricEditorMode = MetricEditorMode.Code;
        render(<MetricsQueryEditor {...props} />);

        expect(screen.getByText('Metric Search')).toBeInTheDocument();
        const radio = screen.getByLabelText('Code');
        expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
      });
    });

    it('when metric query type is metric query and editor mode is builder', async () => {
      await act(async () => {
        const props = setup();
        if (props.query.queryMode !== 'Metrics') {
          fail(`expected props.query.queryMode to be 'Metrics', got '${props.query.queryMode}' instead`);
        }
        props.query.metricQueryType = MetricQueryType.Query;
        props.query.metricEditorMode = MetricEditorMode.Builder;
        render(<MetricsQueryEditor {...props} />);

        expect(screen.getByText('Metric Query')).toBeInTheDocument();
        const radio = screen.getByLabelText('Builder');
        expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
      });
    });

    it('when metric query type is metric query and editor mode is raw', async () => {
      await act(async () => {
        const props = setup();
        if (props.query.queryMode !== 'Metrics') {
          fail(`expected props.query.queryMode to be 'Metrics', got '${props.query.queryMode}' instead`);
        }
        props.query.metricQueryType = MetricQueryType.Query;
        props.query.metricEditorMode = MetricEditorMode.Code;
        render(<MetricsQueryEditor {...props} />);

        expect(screen.getByText('Metric Query')).toBeInTheDocument();
        const radio = screen.getByLabelText('Code');
        expect(radio instanceof HTMLInputElement && radio.checked).toBeTruthy();
      });
    });
  });

  describe('should handle expression options correctly', () => {
    it('should display match exact switch', async () => {
      const props = setup();
      render(<MetricsQueryEditor {...props} />);
      expect(await screen.findByText('Match exact')).toBeInTheDocument();
    });

    it('shoud display wildcard option in dimension value dropdown', async () => {
      const props = setup();
      if (props.query.queryMode !== 'Metrics') {
        fail(`expected props.query.queryMode to be 'Metrics', got '${props.query.queryMode}' instead`);
      }
      props.datasource.getDimensionValues = jest.fn().mockResolvedValue([[{ label: 'dimVal1', value: 'dimVal1' }]]);
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
});
