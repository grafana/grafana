import React from 'react';
import renderer from 'react-test-renderer';
import { StackdriverTemplateQueryComponent } from './TemplateQueryComponent';
import { TemplateQueryProps } from 'app/types/plugins';

describe('StackdriverTemplateQueryComponent', () => {
  const props: TemplateQueryProps = {
    onChange: (query, definition) => {},
    query: '',
    datasource: {},
  };

  it('renders correctly', () => {
    const tree = renderer.create(<StackdriverTemplateQueryComponent {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
