import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type SceneObject } from '@grafana/scenes';

import { PanelPulseMentions } from './PanelPulseMentions';

// Mock the locationService partial so we can assert the navigation
// payload without spinning up a full router. partial(true) — replace
// — is what we want for an in-place URL update like opening a drawer.
const partialMock = jest.fn();
jest.mock('@grafana/runtime', () => {
  const actual = jest.requireActual('@grafana/runtime');
  return {
    ...actual,
    locationService: {
      ...actual.locationService,
      partial: (...args: unknown[]) => partialMock(...args),
    },
    config: {
      ...actual.config,
      featureToggles: { ...actual.config.featureToggles, dashboardPulse: true },
    },
  };
});

const useListPanelMentionsQueryMock = jest.fn();
jest.mock('app/features/pulse/api/pulseApi', () => ({
  useListPanelMentionsQuery: (...args: unknown[]) => useListPanelMentionsQueryMock(...args),
}));

// Replace getRoot() with a stub that satisfies our constructor-name
// guard and exposes a `useState` hook returning the dashboard uid.
function withStubDashboardRoot(model: PanelPulseMentions, uid = 'dash-uid'): PanelPulseMentions {
  const fakeRoot = {
    constructor: { name: 'DashboardScene' },
    useState: () => ({ uid }),
  } as unknown as SceneObject;
  // getRoot is normally inherited; override per-instance for the test.
  (model as unknown as { getRoot: () => SceneObject }).getRoot = () => fakeRoot;
  return model;
}

describe('PanelPulseMentions', () => {
  beforeEach(() => {
    partialMock.mockReset();
    useListPanelMentionsQueryMock.mockReset();
  });

  it('renders nothing when the query returns no mentions for this panel', () => {
    useListPanelMentionsQueryMock.mockReturnValue({
      data: { resourceKind: 'dashboard', resourceUID: 'dash-uid', mentions: [] },
    });

    const model = withStubDashboardRoot(new PanelPulseMentions({ panelId: 5 }));
    const { container } = render(<PanelPulseMentions.Component model={model} />);

    expect(container).toBeEmptyDOMElement();
    // The query should still have been issued (we are enabled and have a uid)
    expect(useListPanelMentionsQueryMock).toHaveBeenCalledWith(
      { resourceKind: 'dashboard', resourceUID: 'dash-uid' },
      { skip: false }
    );
  });

  it('renders an icon and tooltip when one thread mentions the panel, and click deep-links to that thread', async () => {
    useListPanelMentionsQueryMock.mockReturnValue({
      data: {
        resourceKind: 'dashboard',
        resourceUID: 'dash-uid',
        mentions: [
          {
            panelId: 5,
            threadCount: 1,
            latestThreadUID: 'thread-abc',
            latestThreadTitle: 'p99 spike',
          },
        ],
      },
    });

    const model = withStubDashboardRoot(new PanelPulseMentions({ panelId: 5 }));
    render(<PanelPulseMentions.Component model={model} />);

    // The clickable element is the TitleItem button rendered by PanelChrome.
    // Tooltip wraps it and is announced via aria-label / title; we look up
    // by role to avoid coupling the test to PanelChrome internals.
    const button = await screen.findByRole('button');
    await userEvent.click(button);

    // Single match → deep link to the specific thread; we also clear
    // any stale pulsePanel filter so a previous filtered URL doesn't
    // leak into the deep-link.
    expect(partialMock).toHaveBeenCalledWith(
      { pulse: 'thread-thread-abc', pulsePanel: null },
      true
    );
  });

  it('applies the panel filter when multiple threads mention the panel', async () => {
    useListPanelMentionsQueryMock.mockReturnValue({
      data: {
        resourceKind: 'dashboard',
        resourceUID: 'dash-uid',
        mentions: [
          {
            panelId: 7,
            threadCount: 3,
            latestThreadUID: 'thread-most-recent',
          },
        ],
      },
    });

    const model = withStubDashboardRoot(new PanelPulseMentions({ panelId: 7 }));
    render(<PanelPulseMentions.Component model={model} />);

    await userEvent.click(await screen.findByRole('button'));

    // Multiple matches → open the drawer with the panel filter
    // pre-applied. We pin `pulse=open` alongside `pulsePanel` so the
    // drawer mounts even when the URL didn't already contain the
    // `pulse` key.
    expect(partialMock).toHaveBeenCalledWith({ pulse: 'open', pulsePanel: '7' }, true);
  });

  it('skips the network call entirely when there is no resource uid yet', () => {
    useListPanelMentionsQueryMock.mockReturnValue({ data: undefined });

    const model = withStubDashboardRoot(new PanelPulseMentions({ panelId: 5 }), '');
    const { container } = render(<PanelPulseMentions.Component model={model} />);

    expect(container).toBeEmptyDOMElement();
    // skip flips true so RTK Query never fires
    expect(useListPanelMentionsQueryMock).toHaveBeenCalledWith(
      { resourceKind: 'dashboard', resourceUID: '' },
      { skip: true }
    );
  });
});
