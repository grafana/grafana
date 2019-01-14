import React from 'react';
import renderer from 'react-test-renderer';
import { QueryEditor, Props, DefaultTarget } from './QueryEditor';
import { TemplateSrv } from 'app/features/templating/template_srv';

const props: Props = {
  onQueryChange: target => {},
  onExecuteQuery: () => {},
  target: DefaultTarget,
  events: { on: () => {} },
  datasource: {
    getDefaultProject: () => Promise.resolve('project'),
    getMetricTypes: () => Promise.resolve([]),
  } as any,
  templateSrv: new TemplateSrv(),
};

describe('QueryEditor', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<QueryEditor {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
