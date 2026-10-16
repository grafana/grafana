import { reportInteraction } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  canFloatExtensionSidebar,
  claimFloatingExtensionSidebar,
  getEffectiveExtensionSidebarPresentation,
  getRequestedExtensionSidebarPresentation,
  holdFloatingExtensionSidebar,
  isFloatingExtensionSidebarHeld,
  notifyExtensionSidebarClosed,
  onExtensionSidebarClosed,
  releaseFloatingExtensionSidebarHolds,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarPresentation,
  subscribeToExtensionSidebarPresentation,
} from './extensionSidebarLayout';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const FLOATING_FLAG = 'grafana.extensionSidebarFloating';
const ASSISTANT = 'grafana-assistant-app';

describe('extensionSidebarLayout', () => {
  afterEach(() => {
    resetExtensionSidebarPresentationForTests();
    setTestFlags({});
    jest.mocked(reportInteraction).mockClear();
  });

  it('floats only while the flag is on', () => {
    expect(canFloatExtensionSidebar()).toBe(false);
    setExtensionSidebarPresentation('docked');
    setExtensionSidebarPresentation('floating');
    expect(getRequestedExtensionSidebarPresentation()).toBe('docked');

    setTestFlags({ [FLOATING_FLAG]: true });
    expect(canFloatExtensionSidebar()).toBe(true);
    setExtensionSidebarPresentation('floating');
    expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
  });

  it('docks with the flag off', () => {
    setTestFlags({ [FLOATING_FLAG]: true });
    setExtensionSidebarPresentation('floating');
    setTestFlags({ [FLOATING_FLAG]: false });

    setExtensionSidebarPresentation('docked');

    expect(getRequestedExtensionSidebarPresentation()).toBe('docked');
  });

  it('floats every page by default', () => {
    expect(getRequestedExtensionSidebarPresentation('/d/abc/my-dashboard')).toBe('floating');
    expect(getRequestedExtensionSidebarPresentation('/dashboard/new')).toBe('floating');
    expect(getRequestedExtensionSidebarPresentation('/notebooks/xyz')).toBe('floating');
    expect(getRequestedExtensionSidebarPresentation('/explore')).toBe('floating');
  });

  it('remembers the layout for dashboards and notebooks apart from other pages', () => {
    setTestFlags({ [FLOATING_FLAG]: true });

    setExtensionSidebarPresentation('docked', '/d/abc');
    expect(getRequestedExtensionSidebarPresentation('/notebooks/xyz')).toBe('docked');
    expect(getRequestedExtensionSidebarPresentation('/explore')).toBe('floating');

    setExtensionSidebarPresentation('docked', '/explore');
    expect(getRequestedExtensionSidebarPresentation('/alerting/list')).toBe('docked');
    setExtensionSidebarPresentation('floating', '/d/abc');
    expect(getRequestedExtensionSidebarPresentation('/d/abc')).toBe('floating');
    expect(getRequestedExtensionSidebarPresentation('/explore')).toBe('docked');
  });

  it('holds the floating sidebar hidden until every hold is released, or all are released at once', () => {
    const listener = jest.fn();
    subscribeToExtensionSidebarPresentation(listener);
    expect(isFloatingExtensionSidebarHeld()).toBe(false);

    const releaseA = holdFloatingExtensionSidebar();
    const releaseB = holdFloatingExtensionSidebar();
    expect(isFloatingExtensionSidebarHeld()).toBe(true);
    releaseA();
    releaseA();
    expect(isFloatingExtensionSidebarHeld()).toBe(true);
    releaseB();
    expect(isFloatingExtensionSidebarHeld()).toBe(false);
    // Two holds and two releases; a repeated release notifies nothing.
    expect(listener).toHaveBeenCalledTimes(4);

    const releaseC = holdFloatingExtensionSidebar();
    releaseFloatingExtensionSidebarHolds();
    expect(isFloatingExtensionSidebarHeld()).toBe(false);
    // Released already, its own release is harmless.
    releaseC();
    expect(isFloatingExtensionSidebarHeld()).toBe(false);
  });

  it('notifies subscribers only when the layout changes', () => {
    setTestFlags({ [FLOATING_FLAG]: true });
    const listener = jest.fn();
    const unsubscribe = subscribeToExtensionSidebarPresentation(listener);

    setExtensionSidebarPresentation('docked');
    setExtensionSidebarPresentation('docked');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setExtensionSidebarPresentation('floating');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports each layout change with the surface it applies to, and nothing for an unchanged or refused one', () => {
    setExtensionSidebarPresentation('docked', '/d/abc');
    setExtensionSidebarPresentation('docked', '/d/abc');
    // Floating is refused while the flag is off.
    setExtensionSidebarPresentation('floating', '/d/abc');
    setTestFlags({ [FLOATING_FLAG]: true });
    setExtensionSidebarPresentation('floating', '/explore');
    setExtensionSidebarPresentation('floating', '/d/abc');

    expect(jest.mocked(reportInteraction).mock.calls).toEqual([
      [
        'grafana_extension_sidebar_presentation_changed',
        { from: 'floating', to: 'docked', surface: 'dashboardOrNotebook' },
      ],
      [
        'grafana_extension_sidebar_presentation_changed',
        { from: 'docked', to: 'floating', surface: 'dashboardOrNotebook' },
      ],
    ]);
  });

  describe('floating claims', () => {
    it('float the sidebar with the flag off until the last one is released', () => {
      const releaseFirst = claimFloatingExtensionSidebar();
      const releaseSecond = claimFloatingExtensionSidebar();
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');

      releaseFirst();
      releaseFirst();
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');

      releaseSecond();
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('docked');
    });

    it('float only a plugin that supports floating', () => {
      claimFloatingExtensionSidebar();

      expect(getEffectiveExtensionSidebarPresentation('other-app')).toBe('docked');
      expect(getEffectiveExtensionSidebarPresentation(undefined)).toBe('docked');
    });

    it("bring back the user's layout when released", () => {
      setTestFlags({ [FLOATING_FLAG]: true });
      setExtensionSidebarPresentation('floating');
      const releaseFloating = claimFloatingExtensionSidebar();
      releaseFloating();
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');

      setExtensionSidebarPresentation('docked');
      const releaseDocked = claimFloatingExtensionSidebar();
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');
      releaseDocked();
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('docked');
    });

    it('are withdrawn when the user docks the sidebar, after it has docked', () => {
      setExtensionSidebarPresentation('docked');
      const seen: string[] = [];
      const onDocked = jest.fn(() => seen.push(getEffectiveExtensionSidebarPresentation(ASSISTANT)));
      claimFloatingExtensionSidebar({ onDocked });

      // Already docked as requested, docking still withdraws the claim.
      setExtensionSidebarPresentation('docked');

      expect(onDocked).toHaveBeenCalledTimes(1);
      expect(seen).toEqual(['docked']);
      setExtensionSidebarPresentation('docked');
      expect(onDocked).toHaveBeenCalledTimes(1);
    });

    it('are not ended by a floating request the flag ignores', () => {
      const onDocked = jest.fn();
      claimFloatingExtensionSidebar({ onDocked });

      setExtensionSidebarPresentation('floating');

      expect(onDocked).not.toHaveBeenCalled();
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');
    });
  });

  it('tells close listeners when the sidebar closes, until they unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = onExtensionSidebarClosed(listener);

    notifyExtensionSidebarClosed();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    notifyExtensionSidebarClosed();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
