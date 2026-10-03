import { render, screen } from '@testing-library/react';
import { TestProvider } from 'test/helpers/TestProvider';
import { getGrafanaContextMock } from 'test/mocks/getGrafanaContextMock';

import { type NavModelItem, PageLayoutType } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Heading, HeadingRoot, HeadingSection, type HeadingLevel } from '@grafana/ui';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';

import { Page } from './Page';
import { type PageProps } from './types';

const pageNav: NavModelItem = {
  text: 'pageNav title',
  children: [
    { text: 'pageNav child1', url: '1', active: true },
    { text: 'pageNav child2', url: '2' },
  ],
};
const setup = (
  props: Partial<PageProps>,
  children: PageProps['children'] = <div data-testid="page-children">Children</div>,
  headingLevel?: HeadingLevel
) => {
  config.bootData.navTree = [
    {
      id: HOME_NAV_ID,
      text: 'Home',
      url: '/',
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
  const page = <Page {...props}>{children}</Page>;

  const renderResult = render(
    <TestProvider grafanaContext={context}>
      {headingLevel ? <HeadingRoot level={headingLevel}>{page}</HeadingRoot> : page}
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

  it('should render page title and content heading at successive levels', () => {
    setup({ pageNav }, <Heading variant="h2">Page content</Heading>);

    expect(screen.getByRole('heading', { name: 'pageNav title', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page content', level: 2 })).toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('should inherit the root heading level and increment nested sections', () => {
    setup(
      { pageNav },
      <>
        <Heading variant="h2">Page content</Heading>
        <HeadingSection>
          <Heading variant="h3">Nested content</Heading>
        </HeadingSection>
      </>,
      3
    );

    expect(screen.getByRole('heading', { name: 'pageNav title', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Page content', level: 4 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Nested content', level: 5 })).toBeInTheDocument();
  });

  it.each([
    { name: 'Standard', layout: PageLayoutType.Standard },
    { name: 'Canvas', layout: PageLayoutType.Canvas, pageNav },
    { name: 'Custom', layout: PageLayoutType.Custom, pageNav },
  ])(
    'should preserve the inherited heading level without a rendered page header in $name layout',
    ({ layout, pageNav: testPageNav }) => {
      setup({ layout, pageNav: testPageNav }, <Heading variant="h2">Page content</Heading>, 3);

      expect(screen.getByRole('heading', { name: 'Page content', level: 3 })).toBeInTheDocument();
    }
  );

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
