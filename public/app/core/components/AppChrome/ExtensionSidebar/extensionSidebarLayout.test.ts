import { reportInteraction } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  canFloatExtensionSidebar,
  getEffectiveExtensionSidebarPresentation,
  getRequestedExtensionSidebarPresentation,
  holdFloatingExtensionSidebar,
  isExtensionSidebarFloatingOverridden,
  isFloatingExtensionSidebarHeld,
  notifyExtensionSidebarClosed,
  onExtensionSidebarClosed,
  releaseFloatingExtensionSidebarHolds,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarFloatingOverride,
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

  describe('the floating override', () => {
    it('floats the sidebar with the flag off until it is turned off', () => {
      setExtensionSidebarFloatingOverride(true);
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');

      setExtensionSidebarFloatingOverride(false);
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('docked');
    });

    it('floats only a plugin that supports floating', () => {
      setExtensionSidebarFloatingOverride(true);

      expect(getEffectiveExtensionSidebarPresentation('other-app')).toBe('docked');
      expect(getEffectiveExtensionSidebarPresentation(undefined)).toBe('docked');
    });

    it("brings back the user's layout when turned off", () => {
      setTestFlags({ [FLOATING_FLAG]: true });
      setExtensionSidebarPresentation('floating');
      setExtensionSidebarFloatingOverride(true);
      setExtensionSidebarFloatingOverride(false);
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');

      setExtensionSidebarPresentation('docked');
      setExtensionSidebarFloatingOverride(true);
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');
      setExtensionSidebarFloatingOverride(false);
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('docked');
    });

    it('turns off when the user docks the sidebar, even if already docked as requested', () => {
      setExtensionSidebarPresentation('docked');
      setExtensionSidebarFloatingOverride(true);

      setExtensionSidebarPresentation('docked');

      expect(isExtensionSidebarFloatingOverridden()).toBe(false);
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('docked');
    });

    it('stays on for a floating request the flag ignores', () => {
      setExtensionSidebarFloatingOverride(true);

      setExtensionSidebarPresentation('floating');

      expect(isExtensionSidebarFloatingOverridden()).toBe(true);
      expect(getEffectiveExtensionSidebarPresentation(ASSISTANT)).toBe('floating');
    });

    it('is not saved', () => {
      const key = 'grafana.navigation.extensionSidebarPresentationBySurface';
      const saved = window.localStorage.getItem(key);

      setExtensionSidebarFloatingOverride(true);

      expect(window.localStorage.getItem(key)).toBe(saved);
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
