import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';
import { DashboardLink } from '@grafana/schema';

import { DashboardLinkRenderer } from './DashboardLinkRenderer';

const mockGetAnchorInfo = jest.fn();
const mockGetLinkUrl = jest.fn();

jest.mock('app/features/panel/panellinks/link_srv', () => ({
  getLinkSrv: jest.fn(() => ({
    getAnchorInfo: mockGetAnchorInfo,
    getLinkUrl: mockGetLinkUrl,
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
  Tooltip: jest.fn(({ children }) => <div data-testid="tooltip-wrapper">{children}</div>),
}));

describe('DashboardLinkRenderer', () => {
  const dashboardUID = 'test-dashboard-uid';

  beforeEach(() => {
    mockGetAnchorInfo.mockClear();
    mockGetLinkUrl.mockClear();
  });

  it('renders a dashboard type link using the <DashboardLinksDashboard> component', () => {
    const link: DashboardLink = {
      type: 'dashboards', // dashboard type link
      title: 'Dashboard Link',
      url: '',
      icon: 'dashboard',
      tooltip: '',
      tags: ['tag1'],
      asDropdown: false,
      targetBlank: false,
      keepTime: false,
      includeVars: false,
    };

    const linkInfo = {
      title: 'Dashboard Link',
      href: '/d/test-uid/dashboard-link',
      tooltip: null,
    };

    mockGetAnchorInfo.mockReturnValue(linkInfo);

    render(<DashboardLinkRenderer link={link} dashboardUID={dashboardUID} />);

    expect(screen.getByTestId('dashboard-links-dashboard')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Link: Dashboard Link (UID: test-dashboard-uid)')).toBeInTheDocument();
  });

  it('renders a regular link with proper attributes', () => {
    const link: DashboardLink = {
      type: 'link', // regular link
      title: 'External Link',
      url: 'https://example.com',
      icon: 'external link',
      tooltip: '',
      tags: [],
      asDropdown: false,
      targetBlank: true,
      keepTime: false,
      includeVars: false,
    };

    const linkInfo = {
      title: 'External Link',
      href: 'https://example.com',
      tooltip: null,
    };

    mockGetAnchorInfo.mockReturnValue(linkInfo);

    render(<DashboardLinkRenderer link={link} dashboardUID={dashboardUID} />);

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
    const link: DashboardLink = {
      type: 'link',
      title: 'Internal Link',
      url: '/dashboard/internal',
      icon: 'dashboard',
      tooltip: '',
      tags: [],
      asDropdown: false,
      targetBlank: false,
      keepTime: false,
      includeVars: false,
    };

    const linkInfo = {
      title: 'Internal Link',
      href: '/dashboard/internal',
      tooltip: null,
    };

    mockGetAnchorInfo.mockReturnValue(linkInfo);

    render(<DashboardLinkRenderer link={link} dashboardUID={dashboardUID} />);

    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    expect(linkElement).not.toHaveAttribute('target');
    expect(linkElement).toHaveAttribute('rel', 'noreferrer');
  });

  it('renders link with correct icon from LINK_ICON_MAP', () => {
    const link: DashboardLink = {
      type: 'link',
      title: 'Question Link',
      url: '/help',
      icon: 'question',
      tooltip: '',
      tags: [],
      asDropdown: false,
      targetBlank: false,
      keepTime: false,
      includeVars: false,
    };

    const linkInfo = {
      title: 'Question Link',
      href: '/help',
      tooltip: null,
    };

    mockGetAnchorInfo.mockReturnValue(linkInfo);

    render(<DashboardLinkRenderer link={link} dashboardUID={dashboardUID} />);

    const iconElement = screen.getByTestId('link-icon');
    expect(iconElement).toBeInTheDocument();
    expect(iconElement).toHaveTextContent('question-circle');
  });

  it('renders link with tooltip when tooltip is provided', () => {
    const link: DashboardLink = {
      type: 'link',
      title: 'Link with Tooltip',
      url: '/dashboard/test',
      icon: 'info',
      tooltip: 'This is a helpful tooltip',
      tags: [],
      asDropdown: false,
      targetBlank: false,
      keepTime: false,
      includeVars: false,
    };

    const linkInfo = {
      title: 'Link with Tooltip',
      href: '/dashboard/test',
      tooltip: 'This is a helpful tooltip',
    };

    mockGetAnchorInfo.mockReturnValue(linkInfo);

    render(<DashboardLinkRenderer link={link} dashboardUID={dashboardUID} />);

    // The tooltip component should be rendered around the link
    const container = screen.getByTestId(selectors.components.DashboardLinks.container);
    expect(container).toBeInTheDocument();

    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    expect(linkElement).toHaveTextContent('Link with Tooltip');
  });

  it('renders link without tooltip wrapper when tooltip is empty', () => {
    const link: DashboardLink = {
      type: 'link',
      title: 'Link without Tooltip',
      url: '/dashboard/test',
      icon: 'bolt',
      tooltip: '',
      tags: [],
      asDropdown: false,
      targetBlank: false,
      keepTime: false,
      includeVars: false,
    };

    const linkInfo = {
      title: 'Link without Tooltip',
      href: '/dashboard/test',
      tooltip: null,
    };

    mockGetAnchorInfo.mockReturnValue(linkInfo);

    render(<DashboardLinkRenderer link={link} dashboardUID={dashboardUID} />);

    const container = screen.getByTestId(selectors.components.DashboardLinks.container);
    expect(container).toBeInTheDocument();

    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    expect(linkElement).toHaveTextContent('Link without Tooltip');
  });

  it('handles undefined icon gracefully', () => {
    const link: DashboardLink = {
      type: 'link',
      title: 'Link with Unknown Icon',
      url: '/dashboard/test',
      icon: 'unknown-icon',
      tooltip: '',
      tags: [],
      asDropdown: false,
      targetBlank: false,
      keepTime: false,
      includeVars: false,
    };

    const linkInfo = {
      title: 'Link with Unknown Icon',
      href: '/dashboard/test',
      tooltip: null,
    };

    mockGetAnchorInfo.mockReturnValue(linkInfo);

    render(<DashboardLinkRenderer link={link} dashboardUID={dashboardUID} />);

    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    expect(linkElement).toHaveTextContent('Link with Unknown Icon');

    // Should not render an icon when the icon is not in the map
    expect(screen.queryByTestId('link-icon')).not.toBeInTheDocument();
  });

  it('sanitizes the URL from linkInfo', () => {
    const link: DashboardLink = {
      type: 'link',
      title: 'Potentially Unsafe Link',
      url: 'javascript:alert("xss")',
      icon: 'external link',
      tooltip: '',
      tags: [],
      asDropdown: false,
      targetBlank: false,
      keepTime: false,
      includeVars: false,
    };

    const linkInfo = {
      title: 'Potentially Unsafe Link',
      href: 'javascript:alert("xss")',
      tooltip: null,
    };

    mockGetAnchorInfo.mockReturnValue(linkInfo);

    render(<DashboardLinkRenderer link={link} dashboardUID={dashboardUID} />);

    const linkElement = screen.getByTestId(selectors.components.DashboardLinks.link);
    // The sanitizeUrl function should clean the href
    expect(linkElement).toHaveAttribute('href', 'about:blank');
    expect(linkElement).toBeInTheDocument();
  });

  it('calls getLinkSrv().getAnchorInfo with the provided link', () => {
    const link: DashboardLink = {
      type: 'link',
      title: 'Test Link',
      url: '/test',
      icon: 'bolt',
      tooltip: '',
      tags: [],
      asDropdown: false,
      targetBlank: false,
      keepTime: false,
      includeVars: false,
    };

    const linkInfo = {
      title: 'Test Link',
      href: '/test',
      tooltip: null,
    };

    mockGetAnchorInfo.mockReturnValue(linkInfo);

    render(<DashboardLinkRenderer link={link} dashboardUID={dashboardUID} />);

    expect(mockGetAnchorInfo).toHaveBeenCalledWith(link);
    expect(mockGetAnchorInfo).toHaveBeenCalledTimes(1);
  });
});
