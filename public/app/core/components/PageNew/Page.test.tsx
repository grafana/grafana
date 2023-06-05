import { render, screen } from '@testing-library/react';
import React from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { NavModelItem, PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';

import { PageProps } from '../Page/types';

import { Page } from './Page';

const pageNav: NavModelItem = {
  text: 'pageNav title',
  children: [
    { text: 'pageNav child1', url: '1', active: true },
    { text: 'pageNav child2', url: '2' },
  ],
};
const setup = (props: Partial<PageProps>) => {
  config.bootData.navTree = [
    {
      id: HOME_NAV_ID,
      text: 'Home',
    },
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

  const context = getGrafanaContextMock();

  const renderResult = render(
    <TestProvider grafanaContext={context}>
      <Page {...props}>
        <div data-testid="page-children">Children</div>
      </Page>
    </TestProvider>
  );

  return { renderResult, context };
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

    expect(screen.getByRole('heading', { name: 'pageNav title' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').length).toBe(2);
  });

  it('should update chrome with section, pageNav and layout', async () => {
    const { context } = setup({ navId: 'child1', pageNav, layout: PageLayoutType.Canvas });
    expect(context.chrome.state.getValue().sectionNav.node.id).toBe('child1');
    expect(context.chrome.state.getValue().pageNav).toBe(pageNav);
    expect(context.chrome.state.getValue().layout).toBe(PageLayoutType.Canvas);
  });

  it('should update document title', async () => {
    setup({ navId: 'child1', pageNav });
    expect(document.title).toBe('pageNav title - Child1 - Section name - Grafana');
  });

  it('should not include hideFromBreadcrumb nodes in title', async () => {
    pageNav.children![0].hideFromBreadcrumbs = true;
    setup({ navId: 'child1', pageNav });
    expect(document.title).toBe('pageNav title - Child1 - Section name - Grafana');
  });
});
