import { render, screen } from '@testing-library/react';
import React from 'react';
import { Provider } from 'react-redux';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { GrafanaContext } from 'app/core/context/GrafanaContext';
import { configureStore } from 'app/store/configureStore';

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
  const store = configureStore();

  const renderResult = render(
    <Provider store={store}>
      <GrafanaContext.Provider value={context}>
        <Page {...props}>
          <div data-testid="page-children">Children</div>
        </Page>
      </GrafanaContext.Provider>
    </Provider>
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

  it('should render section nav model based on navId', async () => {
    setup({ navId: 'child1' });

    expect(screen.getByRole('tab', { name: 'Tab Section name' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab Child1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab Child1' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').length).toBe(3);
  });

  it('should update chrome with section and pageNav', async () => {
    const { context } = setup({ navId: 'child1', pageNav });
    expect(context.chrome.state.getValue().sectionNav.id).toBe('child1');
    expect(context.chrome.state.getValue().pageNav).toBe(pageNav);
  });

  it('should render section nav model based on navId and item page nav', async () => {
    setup({ navId: 'child1', pageNav });

    expect(screen.getByRole('tab', { name: 'Tab Section name' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'pageNav title' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab Child1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab pageNav child1' })).toBeInTheDocument();
  });
});
