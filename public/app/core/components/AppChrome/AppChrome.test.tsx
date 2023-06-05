import { render, screen } from '@testing-library/react';
import { KBarProvider } from 'kbar';
import React, { ReactNode } from 'react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { ArrayVector, DataFrame, DataFrameView, FieldType, NavModelItem } from '@grafana/data';
import { config } from '@grafana/runtime';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { DashboardQueryResult, getGrafanaSearcher, QueryResponse } from 'app/features/search/service';

import { Page } from '../PageNew/Page';

import { AppChrome } from './AppChrome';

const pageNav: NavModelItem = {
  text: 'pageNav title',
  children: [
    { text: 'pageNav child1', url: '1', active: true },
    { text: 'pageNav child2', url: '2' },
  ],
};

const searchData: DataFrame = {
  fields: [
    { name: 'kind', type: FieldType.string, config: {}, values: new ArrayVector([]) },
    { name: 'name', type: FieldType.string, config: {}, values: new ArrayVector([]) },
    { name: 'uid', type: FieldType.string, config: {}, values: new ArrayVector([]) },
    { name: 'url', type: FieldType.string, config: {}, values: new ArrayVector([]) },
    { name: 'tags', type: FieldType.other, config: {}, values: new ArrayVector([]) },
    { name: 'location', type: FieldType.string, config: {}, values: new ArrayVector([]) },
  ],
  length: 0,
};

const mockSearchResult: QueryResponse = {
  isItemLoaded: jest.fn(),
  loadMoreItems: jest.fn(),
  totalRows: searchData.length,
  view: new DataFrameView<DashboardQueryResult>(searchData),
};

const setup = (children: ReactNode) => {
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
    {
      text: 'Help',
      id: 'help',
    },
  ];

  const context = getGrafanaContextMock();

  const renderResult = render(
    <KBarProvider>
      <TestProvider grafanaContext={context}>
        <AppChrome>
          <div data-testid="page-children">{children}</div>
        </AppChrome>
      </TestProvider>
    </KBarProvider>
  );

  return { renderResult, context };
};

describe('AppChrome', () => {
  beforeAll(() => {
    // need to mock out the search service since kbar calls it to fetch recent dashboards
    jest.spyOn(getGrafanaSearcher(), 'search').mockResolvedValue(mockSearchResult);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render section nav model based on navId', async () => {
    setup(<Page navId="child1">Children</Page>);
    expect(await screen.findByTestId('page-children')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: 'Tab Section name' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab Child1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab Child1' })).toBeInTheDocument();
    expect(screen.getAllByRole('tab').length).toBe(3);
  });

  it('should render section nav model based on navId and item page nav', async () => {
    setup(
      <Page navId="child1" pageNav={pageNav}>
        Children
      </Page>
    );
    expect(await screen.findByTestId('page-children')).toBeInTheDocument();

    expect(screen.getByRole('tab', { name: 'Tab Section name' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'pageNav title' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab Child1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tab pageNav child1' })).toBeInTheDocument();
  });
});
