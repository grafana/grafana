export const testTpl = `
import React from 'react';
import { render, screen } from '@testing-library/react';
import { <%= name %> } from './<%= name %>';


describe('<%= name %>', () => {
  it.skip('should render', () => {

  });
});
`;
