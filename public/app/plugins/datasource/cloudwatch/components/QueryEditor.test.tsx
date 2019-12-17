import React from 'react';
import renderer from 'react-test-renderer';
import { mount } from 'enzyme';
import { act } from 'react-dom/test-utils';
import { DataSourceInstanceSettings } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CustomVariable } from 'app/features/templating/all';
import { QueryEditor, Props, normalizeQuery } from './QueryEditor';
import CloudWatchDatasource from '../datasource';

const setup = () => {
  const instanceSettings = {
    jsonData: { defaultRegion: 'us-east-1' },
  } as DataSourceInstanceSettings;

  const templateSrv = new TemplateSrv();
  templateSrv.init([
    new CustomVariable(
      {
        name: 'var3',
        options: [
          { selected: true, value: 'var3-foo' },
          { selected: false, value: 'var3-bar' },
          { selected: true, value: 'var3-baz' },
        ],
        current: {
          value: ['var3-foo', 'var3-baz'],
        },
        multi: true,
      },
      {} as any
    ),
  ]);

  const datasource = new CloudWatchDatasource(instanceSettings, templateSrv as any, {} as any);
  datasource.metricFindQuery = async () => [{ value: 'test', label: 'test' }];

  const props: Props = {
    query: {
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
      const tree = renderer.create(<QueryEditor {...props} />).toJSON();
      expect(tree).toMatchSnapshot();
    });
  });

  describe('should use correct default values', () => {
    it('when region is null is display default in the label', async () => {
      await act(async () => {
        const props = setup();
        props.query.region = null;
        const wrapper = mount(<QueryEditor {...props} />);
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
        refId: '42',
      });
    });
  });
});
