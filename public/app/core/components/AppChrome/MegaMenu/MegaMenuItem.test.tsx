import { type ComponentProps } from 'react';
import { act, getWrapper, render, screen } from 'test/test-utils';

import { type NavModelItem } from '@grafana/data';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { StPodReadyService, StPodStatus } from 'app/core/services/StPodReadyService';
import { contextSrv } from 'app/core/services/context_srv';

import { MegaMenuItem } from './MegaMenuItem';

const nonAllowListedLink: NavModelItem = {
  id: 'explore',
  text: 'Explore',
  url: '/explore',
};

const noop = () => {};

const renderMenuItem = (service: StPodReadyService, overrides: Partial<ComponentProps<typeof MegaMenuItem>> = {}) => {
  const wrapper = getWrapper({ grafanaContext: { stPodReady: service }, renderWithRouter: true });
  return render(<MegaMenuItem link={nonAllowListedLink} onPin={noop} isPinned={() => false} {...overrides} />, {
    wrapper,
  });
};

describe('MegaMenuItem StPod loading integration', () => {
  let service: StPodReadyService;

  beforeEach(async () => {
    contextSrv.isSignedIn = true;
    service = new StPodReadyService();
    await act(async () => {
      setTestFlags({ [FlagKeys.GrafanaMtFallback]: { allowList: ['/dashboards'] } });
    });
  });

  afterEach(async () => {
    service.stop();
    contextSrv.isSignedIn = false;
    await act(async () => {
      setTestFlags({});
    });
  });

  it('does not render the preparing dots on a non-allow-listed item while the service is still unknown', () => {
    renderMenuItem(service);

    expect(document.querySelector('.st-pod-dots')).not.toBeInTheDocument();
  });

  it('renders the preparing dots on a non-allow-listed item once the pod reports it is still starting', () => {
    act(() => service.state.next(StPodStatus.Waiting));

    renderMenuItem(service);

    expect(document.querySelector('.st-pod-dots')).toBeInTheDocument();
  });

  it('shows the preparing tooltip when hovering a non-active loading item', async () => {
    act(() => service.state.next(StPodStatus.Waiting));

    const { user } = renderMenuItem(service);
    await user.hover(screen.getByRole('link', { name: /Explore/ }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Preparing Explore');
  });

  it('suppresses the preparing tooltip on the active item even while loading', async () => {
    act(() => service.state.next(StPodStatus.Waiting));

    const { user } = renderMenuItem(service, { activeItem: nonAllowListedLink });
    await user.hover(screen.getByRole('link', { name: /Explore/ }));

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('removes the preparing dots once the pod reports ready', () => {
    act(() => service.state.next(StPodStatus.Waiting));
    renderMenuItem(service);
    expect(document.querySelector('.st-pod-dots')).toBeInTheDocument();

    act(() => service.state.next(StPodStatus.Ready));

    expect(document.querySelector('.st-pod-dots')).not.toBeInTheDocument();
  });
});

describe('MegaMenuItem rendering branches', () => {
  let service: StPodReadyService;

  beforeEach(() => {
    contextSrv.isSignedIn = true;
    service = new StPodReadyService();
  });

  afterEach(() => {
    service.stop();
    contextSrv.isSignedIn = false;
  });

  it('renders nothing when the link has no url', () => {
    const { container } = renderMenuItem(service, { link: { id: 'orphan', text: 'Orphan' } });

    expect(container).toBeEmptyDOMElement();
  });

  it('labels a starred folder leaf icon so screen readers can tell folders and dashboards apart', () => {
    const starredFolder: NavModelItem = {
      id: 'starred/abc',
      text: 'My Folder',
      url: '/dashboards/f/abc',
      icon: 'folder',
    };

    renderMenuItem(service, { link: starredFolder });

    expect(screen.getByTitle('Folder')).toBeInTheDocument();
  });

  it('labels a starred dashboard leaf icon so screen readers can tell folders and dashboards apart', () => {
    const starredDashboard: NavModelItem = {
      id: 'starred/xyz',
      text: 'My Dashboard',
      url: '/d/xyz',
      icon: 'apps',
    };

    renderMenuItem(service, { link: starredDashboard });

    expect(screen.getByTitle('Dashboard')).toBeInTheDocument();
  });

  it('renders loading skeletons for an expanded section whose children are being fetched', () => {
    const section: NavModelItem = {
      id: 'dynamic',
      text: 'Dynamic',
      url: '/dynamic',
      children: [],
    };

    renderMenuItem(service, { link: section, loadingChildren: true, defaultExpanded: true });

    expect(screen.getByLabelText('Loading Dynamic')).toBeInTheDocument();
  });

  it('renders an error message for an expanded section whose children failed to load', () => {
    const section: NavModelItem = {
      id: 'dynamic',
      text: 'Dynamic',
      url: '/dynamic',
      children: [],
    };

    renderMenuItem(service, { link: section, childrenLoadError: true, defaultExpanded: true });

    expect(screen.getByText('Failed to load items')).toBeInTheDocument();
  });

  it('renders the empty message for an expanded section with no children and no loading state', () => {
    const section: NavModelItem = {
      id: 'empty',
      text: 'Empty',
      url: '/empty',
      emptyMessage: 'Nothing here yet',
      children: [],
    };

    renderMenuItem(service, { link: section, defaultExpanded: true });

    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
  });
});
