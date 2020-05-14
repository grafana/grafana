export const testTpl = `
import React from 'react';
import { shallow } from 'enzyme';
import { <%= name %> } from './<%= name %>';


describe('<%= name %>', () => {
  it.skip('should render', () => {

  });
});
`;
