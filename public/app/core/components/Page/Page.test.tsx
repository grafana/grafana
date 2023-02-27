import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';

import { Page } from './Page';
import { PageProps } from './types';

const pageNav: NavModelItem = {
  text: 'Main title',
  children: [
    { text: 'Child1', url: '1', active: true },
    { text: 'Child2', url: '2' },
  ],
};

const setup = (props: Partial<PageProps>) => {
  config.bootData.navTree = [
    {
      text: 'Section name',
      id: 'section',
      url: 'section',
      children: [
        { text: 'Child1', id: 'child1', url: 'section/child1' },
        { text: 'Child2', id: 'child2', url: 'section/child2' },
      ],
    },
  ];

  return render(
    <TestProvider>
      <Page {...props}>
        <div data-testid="page-children">Children</div>
      </Page>
    </TestProvider>
  );
};

describe('Render', () => {
  it('should render component with emtpy Page container', async () => {
    setup({});
    const children = await screen.findByTestId('page-children');
    expect(children).toBeInTheDocument();

    const pageHeader = screen.queryByRole('heading');
    expect(pageHeader).not.toBeInTheDocument();
  });

  it('should render header when pageNav supplied', async () => {
    setup({ pageNav });

    expect(screen.getByRole('heading', { name: 'Main title' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').length).toBe(2);
  });

  it('should get header nav model from redux navIndex', async () => {
    setup({ navId: 'child1' });

    expect(screen.getByRole('heading', { name: 'Section name' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').length).toBe(2);
  });
});
