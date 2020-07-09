import React from 'react';
import renderer from 'react-test-renderer';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { DataSourceInstanceSettings } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { MetricsQueryEditor, normalizeQuery, Props } from './MetricsQueryEditor';
import { CloudWatchDatasource } from '../datasource';
import { CustomVariableModel, VariableHide } from '../../../../features/variables/types';

const setup = () => {
  const instanceSettings = {
    jsonData: { defaultRegion: 'us-east-1' },
  } as DataSourceInstanceSettings;

  const templateSrv = new TemplateSrv();
  const variable: CustomVariableModel = {
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
    hide: VariableHide.dontHide,
    type: 'custom',
    label: null,
    skipUrlSync: false,
    global: false,
  };
  templateSrv.init([variable]);

  const datasource = new CloudWatchDatasource(instanceSettings, templateSrv as any, {} as any);
  datasource.metricFindQuery = async () => [{ value: 'test', label: 'test' }];

  const props: Props = {
    query: {
      queryMode: 'Metrics',
      refId: '',
      id: '',
      region: 'us-east-1',
      namespace: 'ec2',
      metricName: 'CPUUtilization',
      dimensions: { somekey: 'somevalue' },
      statistics: [],
      period: '',
      expression: '',
      alias: '',
      matchExact: true,
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

  it('normalizes query on mount', async () => {
    const { act } = renderer;
    const props = setup();
    // This does not actually even conform to the prop type but this happens on initialisation somehow
    props.query = {
      queryMode: 'Metrics',
      apiMode: 'Metrics',
      refId: '',
      expression: '',
      matchExact: true,
    } as any;
    await act(async () => {
      renderer.create(<MetricsQueryEditor {...props} />);
    });
    expect((props.onChange as jest.Mock).mock.calls[0][0]).toEqual({
      namespace: '',
      metricName: '',
      expression: '',
      dimensions: {},
      region: 'default',
      id: '',
      alias: '',
      statistics: ['Average'],
      period: '',
      queryMode: 'Metrics',
      apiMode: 'Metrics',
      refId: '',
      matchExact: true,
    });
  });

  describe('should use correct default values', () => {
    it('when region is null is display default in the label', async () => {
      // @ts-ignore strict null error TS2345: Argument of type '() => Promise<void>' is not assignable to parameter of type '() => void | undefined'.
      await act(async () => {
        const props = setup();
        props.query.region = (null as unknown) as string;
        const wrapper = mount(<MetricsQueryEditor {...props} />);
        expect(
          wrapper
            .find('.gf-form-inline')
            .first()
            .find('.gf-form-label.query-part')
            .first()
            .text()
        ).toEqual('default');
      });
    });

    it('should normalize query with default values', () => {
      expect(normalizeQuery({ refId: '42' } as any)).toEqual({
        namespace: '',
        metricName: '',
        expression: '',
        dimensions: {},
        region: 'default',
        id: '',
        alias: '',
        statistics: ['Average'],
        matchExact: true,
        period: '',
        refId: '42',
      });
    });
  });
});
