import React from 'react';
import renderer from 'react-test-renderer';
import { DefaultTarget, Props, QueryEditor } from './QueryEditor';
import { TemplateSrv } from 'app/features/templating/template_srv';

const props: Props = {
  onQueryChange: target => {},
  onExecuteQuery: () => {},
  target: DefaultTarget,
  events: { on: () => {} },
  datasource: {
    getProjects: () => Promise.resolve([]),
    getDefaultProject: () => Promise.resolve('projectName'),
    ensureGCEDefaultProject: () => {},
    getMetricTypes: () => Promise.resolve([]),
    getLabels: () => Promise.resolve([]),
    variables: [],
  } as any,
  templateSrv: new TemplateSrv(),
};

describe('QueryEditor', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<QueryEditor {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
