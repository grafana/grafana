import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { type DashboardLinkType, type DashboardLink } from '@grafana/schema';

import { DashboardLinkRenderer } from './DashboardLinkRenderer';
import { DashboardScene } from './DashboardScene';

const mockGetAnchorInfo = jest.fn();

jest.mock('app/features/panel/panellinks/link_srv', () => ({
  getLinkSrv: jest.fn(() => ({
    getAnchorInfo: mockGetAnchorInfo,
  })),
}));

jest.mock('app/features/dashboard/components/SubMenu/DashboardLinksDashboard', () => ({
  DashboardLinksDashboard: jest.fn(({ linkInfo, dashboardUID }) => (
    <div data-testid="dashboard-links-dashboard">
      Dashboard Link: {linkInfo.title} (UID: {dashboardUID})
    </div>
  )),
  DashboardLinkButton: jest.fn(({ children, href, target, icon, ...props }) => (
    <a href={href} target={target} {...props}>
      {icon && <span data-testid="link-icon">{icon}</span>}
      {children}
    </a>
  )),
}));

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Tooltip: jest.fn(({ children, content }) => (
    <div data-testid="tooltip-wrapper" data-tooltip-content={content}>
      {children}
    </div>
  )),
}));

function buildLink({
  type,
  title,
  url,
  targetBlank,
  icon,
  tooltip,
}: {
  type: DashboardLinkType;
  title: string;
  url: string;
  icon?: string;
  tooltip?: string;
  targetBlank?: boolean;
}): DashboardLink {
  const link: DashboardLink = {
    type,
    title,
    url: url || '',
    icon: icon || '',
    tooltip: tooltip || '',
    targetBlank: Boolean(targetBlank),
    asDropdown: false,
    keepTime: false,
    includeVars: false,
    tags: ['tag1'],
  };

  mockGetAnchorInfo.mockReturnValue({
    title: link.title,
    tooltip: link.tooltip,
    href: link.url,
  });

  return link;
}

function buildDashboard(): DashboardScene {
  return new DashboardScene({ uid: 'test-dashboard-uid', title: 'Test Dashboard' });
}

describe('DashboardLinkRenderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders a dashboard type link using the <DashboardLinksDashboard> component', () => {
    const dashboard = buildDashboard();
    const link = buildLink({
      type: 'dashboards',
      title: 'Dashboard Link',
      url: '/d/test-uid/dashboard-link',
    });

    render(
      <DashboardLinkRenderer link={link} dashboardUID={dashboard.state.uid!} linkIndex={0} dashboard={dashboard} />
    );

    expect(screen.getByTestId('dashboard-links-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Link: Dashboard Link (UID: test-dashboard-uid)')).toBeInTheDocument();
  });

  it('renders a regular link with proper attributes', () => {
    const dashboard = buildDashboard();
    const link = buildLink({
      type: 'link',
      title: 'External Link',
      url: 'https://example.com',
      targetBlank: true,
    });

    render(
      <DashboardLinkRenderer link={link} dashboardUID={dashboard.state.uid!} linkIndex={0} dashboard={dashboard} />
    );

    const container = screen.getByTestId(selectors.components.DashboardLinks.container);
    expect(container).toBeInTheDocument();

    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', 'https://example.com');
    expect(linkElement).toHaveAttribute('target', '_blank');
    expect(linkElement).toHaveAttribute('rel', 'noreferrer');
    expect(linkElement).toHaveTextContent('External Link');
  });

  it('renders link without target="_blank" when `targetBlank` is false', () => {
    const dashboard = buildDashboard();
    const link = buildLink({
      type: 'link',
      title: 'Internal Link',
      url: '/dashboard/internal',
      targetBlank: false,
    });

    render(
      <DashboardLinkRenderer link={link} dashboardUID={dashboard.state.uid!} linkIndex={0} dashboard={dashboard} />
    );

    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    expect(linkElement).not.toHaveAttribute('target');
    expect(linkElement).toHaveAttribute('rel', 'noreferrer');
  });

  it('renders link with correct icon from LINK_ICON_MAP', () => {
    const dashboard = buildDashboard();
    const link = buildLink({
      type: 'link',
      title: 'Question Link',
      url: '/help',
      icon: 'question',
    });

    render(
      <DashboardLinkRenderer link={link} dashboardUID={dashboard.state.uid!} linkIndex={0} dashboard={dashboard} />
    );

    const iconElement = screen.getByTestId('link-icon');
    expect(iconElement).toBeInTheDocument();
    expect(iconElement).toHaveTextContent('question-circle');
  });

  it('renders link with tooltip when tooltip is provided', () => {
    const dashboard = buildDashboard();
    const link = buildLink({
      type: 'link',
      title: 'Link with Tooltip',
      url: '/dashboard/test',
      tooltip: 'This is a helpful tooltip',
    });

    render(
      <DashboardLinkRenderer link={link} dashboardUID={dashboard.state.uid!} linkIndex={0} dashboard={dashboard} />
    );

    expect(screen.getByTestId('tooltip-wrapper')).toHaveAttribute('data-tooltip-content', 'This is a helpful tooltip');
    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    expect(linkElement).toHaveTextContent('Link with Tooltip');
  });

  it('renders link without tooltip wrapper when tooltip is empty', () => {
    const dashboard = buildDashboard();
    const link = buildLink({
      type: 'link',
      title: 'Link without Tooltip',
      url: '/dashboard/test',
      tooltip: '',
    });

    render(
      <DashboardLinkRenderer link={link} dashboardUID={dashboard.state.uid!} linkIndex={0} dashboard={dashboard} />
    );

    expect(screen.queryByTestId('tooltip-wrapper')).not.toBeInTheDocument();
    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    expect(linkElement).toHaveTextContent('Link without Tooltip');
  });

  it('handles unknown icon gracefully', () => {
    const dashboard = buildDashboard();
    const link = buildLink({
      type: 'link',
      title: 'Link with Unknown Icon',
      url: '/dashboard/test',
      icon: 'unknown-icon',
    });

    render(
      <DashboardLinkRenderer link={link} dashboardUID={dashboard.state.uid!} linkIndex={0} dashboard={dashboard} />
    );

    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    expect(linkElement).toHaveTextContent('Link with Unknown Icon');

    // Should not render an icon when the icon is not in the map
    expect(screen.queryByTestId('link-icon')).not.toBeInTheDocument();
  });

  it('sanitizes the URL from linkInfo', () => {
    const dashboard = buildDashboard();
    const link = buildLink({
      type: 'link',
      title: 'Potentially Unsafe Link',
      url: 'javascript:alert("xss")',
    });

    render(
      <DashboardLinkRenderer link={link} dashboardUID={dashboard.state.uid!} linkIndex={0} dashboard={dashboard} />
    );

    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    // The sanitizeUrl function should clean the href
    expect(linkElement).toHaveAttribute('href', 'about:blank');
    expect(linkElement).toBeInTheDocument();
  });

  it('calls getLinkSrv().getAnchorInfo with the provided link', () => {
    const dashboard = buildDashboard();
    const link = buildLink({
      type: 'link',
      title: 'Test Link',
      url: '/test',
    });

    render(
      <DashboardLinkRenderer link={link} dashboardUID={dashboard.state.uid!} linkIndex={0} dashboard={dashboard} />
    );

    expect(mockGetAnchorInfo).toHaveBeenCalledTimes(1);
    expect(mockGetAnchorInfo).toHaveBeenCalledWith(link);
  });
});
