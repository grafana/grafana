import React from 'react';
import renderer from 'react-test-renderer';
import { mount } from 'enzyme';
import { DataSourceInstanceSettings } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { CustomVariable } from 'app/features/templating/all';
import { CloudWatchQueryEditor, Props } from './QueryEditor';
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

  const datasource = new CloudWatchDatasource(instanceSettings, {} as any, {} as any, templateSrv as any, {} as any);
  datasource.metricFindQuery = async param => [{ value: 'test', label: 'test' }];

  const props: Props = {
    query: {
      refId: '',
      id: '',
      region: 'us-east-1',
      namespace: 'ec2',
      metricName: 'CPUUtilization',
      dimensions: { somekey: 'somevalue' },
      statistics: new Array<string>(),
      period: '',
      expression: '',
      alias: '',
      highResolution: false,
    },
    datasource,
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
  };

  return props;
};

describe('QueryEditor', () => {
  it('should render component', () => {
    const props = setup();
    const tree = renderer.create(<CloudWatchQueryEditor {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('should use region default in none was given', () => {
    const props = setup();
    props.query.region = '';
    const wrapper = mount(<CloudWatchQueryEditor {...props} />);
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
