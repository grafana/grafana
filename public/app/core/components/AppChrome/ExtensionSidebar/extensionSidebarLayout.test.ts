import { store } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  canCollapseFloatingExtensionSidebar,
  canFloatExtensionSidebar,
  canPlaceExtensionSidebar,
  canPopOutExtensionSidebar,
  collapseFloatingExtensionSidebar,
  getEffectiveExtensionSidebarPresentation,
  getExtensionSidebarPlacement,
  getFloatingExtensionSidebarPlacement,
  getRequestedExtensionSidebarDockSide,
  getRequestedExtensionSidebarPresentation,
  holdFloatingExtensionSidebar,
  isExtensionSidebarFloatingOverridden,
  isFloatingExtensionSidebarHeld,
  notifyExtensionSidebarClosed,
  onExtensionSidebarClosed,
  popOutExtensionSidebar,
  releaseFloatingExtensionSidebarHolds,
  resetExtensionSidebarPresentationForTests,
  resolveExtensionSidebarDockSide,
  setExtensionSidebarDockSide,
  setExtensionSidebarFloatingOverride,
  setExtensionSidebarPlacement,
  setExtensionSidebarPresentation,
  subscribeToExtensionSidebarPopOut,
  subscribeToExtensionSidebarPresentation,
  subscribeToFloatingExtensionSidebarCollapse,
} from './extensionSidebarLayout';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const FLOATING_FLAG = 'grafana.extensionSidebarFloating';

const PLACEMENTS_FLAG = 'grafana.extensionSidebarPlacements';
const ASSISTANT = 'grafana-assistant-app';
const PRESENTATION_KEY = 'grafana.navigation.extensionSidebarPresentation';
const LEGACY_PRESENTATION_KEY = 'grafana.navigation.extensionSidebarPresentationBySurface';
const DOCK_SIDE_KEY = 'grafana.navigation.extensionSidebarDockSide';

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

    setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
    expect(canFloatExtensionSidebar()).toBe(true);
    setExtensionSidebarPresentation('floating');
    expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
  });

  it('docks with the flag off', () => {
    setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
    setExtensionSidebarPresentation('floating');
    setTestFlags({ [FLOATING_FLAG]: false });

    setExtensionSidebarPresentation('docked');

    expect(getRequestedExtensionSidebarPresentation()).toBe('docked');
  });

  it('floats by default', () => {
    expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
  });

  it('remembers one layout for every page', () => {
    setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
    setExtensionSidebarPresentation('docked');
    expect(store.get(PRESENTATION_KEY)).toBe('docked');

    setExtensionSidebarPresentation('floating');
    expect(store.get(PRESENTATION_KEY)).toBe('floating');
    // A later page load reads the same choice, wherever it opens.
    resetExtensionSidebarPresentationForTests({ keepStorage: true });
    expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
  });

  describe('a layout remembered per kind of page', () => {
    it.each([
      [{ dashboardOrNotebook: 'floating', other: 'docked' }, 'floating'],
      [{ dashboardOrNotebook: 'docked', other: 'floating' }, 'floating'],
      [{ dashboardOrNotebook: 'docked', other: 'docked' }, 'docked'],
      [{ other: 'docked' }, 'docked'],
      [{}, 'floating'],
    ])('reads %j as %s', (legacy, expected) => {
      store.setObject(LEGACY_PRESENTATION_KEY, legacy);
      expect(getRequestedExtensionSidebarPresentation()).toBe(expected);
    });

    it('is replaced by the first pick', () => {
      setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
      store.setObject(LEGACY_PRESENTATION_KEY, { dashboardOrNotebook: 'floating', other: 'docked' });

      setExtensionSidebarPresentation('docked');

      expect(store.get(PRESENTATION_KEY)).toBe('docked');
      expect(store.get(LEGACY_PRESENTATION_KEY)).toBeUndefined();
    });
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
    setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
    const listener = jest.fn();
    const unsubscribe = subscribeToExtensionSidebarPresentation(listener);

    setExtensionSidebarPresentation('docked');
    setExtensionSidebarPresentation('docked');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setExtensionSidebarPresentation('floating');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports each layout change, and nothing for an unchanged or refused one', () => {
    setExtensionSidebarPresentation('docked');
    setExtensionSidebarPresentation('docked');
    // Floating is refused while the flag is off.
    setExtensionSidebarPresentation('floating');
    setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
    setExtensionSidebarPresentation('floating');
    setExtensionSidebarPresentation('floating');

    expect(jest.mocked(reportInteraction).mock.calls).toEqual([
      ['grafana_extension_sidebar_presentation_changed', { from: 'floating', to: 'docked' }],
      ['grafana_extension_sidebar_presentation_changed', { from: 'docked', to: 'floating' }],
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
      setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
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

  it('offers to collapse the floating sidebar only while someone listens, and reports each collapse', () => {
    expect(canCollapseFloatingExtensionSidebar()).toBe(false);

    const listener = jest.fn();
    const unsubscribe = subscribeToFloatingExtensionSidebarCollapse(listener);
    expect(canCollapseFloatingExtensionSidebar()).toBe(true);

    collapseFloatingExtensionSidebar();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(reportInteraction).toHaveBeenCalledWith('grafana_extension_sidebar_floating_collapsed', { method: 'drag' });

    unsubscribe();
    expect(canCollapseFloatingExtensionSidebar()).toBe(false);
    collapseFloatingExtensionSidebar();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('offers to open the sidebar in a new window only while someone listens', () => {
    expect(canPopOutExtensionSidebar()).toBe(false);

    const listener = jest.fn();
    const unsubscribe = subscribeToExtensionSidebarPopOut(listener);
    expect(canPopOutExtensionSidebar()).toBe(true);

    popOutExtensionSidebar();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(canPopOutExtensionSidebar()).toBe(false);
    popOutExtensionSidebar();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe('the dock side', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('is the right by default', () => {
      expect(getRequestedExtensionSidebarDockSide()).toBe('right');
    });

    it('is remembered for every page, and reported when it changes', () => {
      const listener = jest.fn();
      subscribeToExtensionSidebarPresentation(listener);

      setExtensionSidebarDockSide('left');
      setExtensionSidebarDockSide('left');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(store.get(DOCK_SIDE_KEY)).toBe('left');
      expect(jest.mocked(reportInteraction).mock.calls).toEqual([
        ['grafana_extension_sidebar_dock_side_changed', { from: 'right', to: 'left' }],
      ]);

      resetExtensionSidebarPresentationForTests({ keepStorage: true });
      expect(getRequestedExtensionSidebarDockSide()).toBe('left');
    });

    it('ignores a stored value that is not a side', () => {
      store.set(DOCK_SIDE_KEY, 'top');
      expect(getRequestedExtensionSidebarDockSide()).toBe('right');
    });

    it('docks on the right when storage is blocked, and keeps a pick for the page load', () => {
      jest.spyOn(store, 'get').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });
      jest.spyOn(store, 'set').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError');
      });

      expect(getRequestedExtensionSidebarDockSide()).toBe('right');
      setExtensionSidebarDockSide('left');
      expect(getRequestedExtensionSidebarDockSide()).toBe('left');
    });

    it('applies the left only while the sidebar can float, and only to a plugin that supports floating', () => {
      expect(resolveExtensionSidebarDockSide('left', true, ASSISTANT)).toBe('left');
      expect(resolveExtensionSidebarDockSide('left', false, ASSISTANT)).toBe('right');
      expect(resolveExtensionSidebarDockSide('left', true, 'grafana-pathfinder-app')).toBe('right');
      expect(resolveExtensionSidebarDockSide('left', true, undefined)).toBe('right');
      expect(resolveExtensionSidebarDockSide('right', true, ASSISTANT)).toBe('right');
    });

    it('remembers the bottom for every page, like the sides', () => {
      setExtensionSidebarDockSide('bottom');
      expect(store.get(DOCK_SIDE_KEY)).toBe('bottom');

      resetExtensionSidebarPresentationForTests({ keepStorage: true });

      expect(getRequestedExtensionSidebarDockSide()).toBe('bottom');
    });

    it('applies the bottom only while the sidebar can float, and only to a plugin that supports floating', () => {
      expect(resolveExtensionSidebarDockSide('bottom', true, ASSISTANT)).toBe('bottom');
      expect(resolveExtensionSidebarDockSide('bottom', false, ASSISTANT)).toBe('right');
      expect(resolveExtensionSidebarDockSide('bottom', true, 'grafana-pathfinder-app')).toBe('right');
      expect(resolveExtensionSidebarDockSide('bottom', true, undefined)).toBe('right');
    });
  });

  describe('the placement', () => {
    afterEach(() => setTestFlags({}));

    it.each(['left', 'right', 'bottom', 'floating'] as const)(
      'moves the sidebar %s in one call, which the Assistant then shows in',
      (placement) => {
        setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
        setExtensionSidebarPlacement(placement === 'floating' ? 'left' : 'floating', 'chat_menu');

        setExtensionSidebarPlacement(placement, 'chat_menu');

        expect(getExtensionSidebarPlacement(ASSISTANT)).toBe(placement);
        expect(getFloatingExtensionSidebarPlacement()).toBe(placement);
      }
    );

    it('reports each move once, with what made it, and nothing when the sidebar stays where it is', () => {
      setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });

      setExtensionSidebarPlacement('left', 'shortcut');
      setExtensionSidebarPlacement('left', 'chat_menu');
      setExtensionSidebarPlacement('floating', 'drag');
      setExtensionSidebarPlacement('bottom', 'plugin');

      const placementChanges = jest
        .mocked(reportInteraction)
        .mock.calls.filter(([name]) => name === 'grafana_extension_sidebar_placement_changed');
      expect(placementChanges).toEqual([
        [
          'grafana_extension_sidebar_placement_changed',
          { placement: 'left', previous_placement: 'floating', source: 'shortcut' },
        ],
        [
          'grafana_extension_sidebar_placement_changed',
          { placement: 'floating', previous_placement: 'left', source: 'drag' },
        ],
        [
          'grafana_extension_sidebar_placement_changed',
          { placement: 'bottom', previous_placement: 'floating', source: 'plugin' },
        ],
      ]);
    });

    it('docks on the new side before docking, so it never shows on the other one', () => {
      setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
      setExtensionSidebarPlacement('floating', 'chat_menu');
      const seen: string[] = [];
      subscribeToExtensionSidebarPresentation(() =>
        seen.push(`${getRequestedExtensionSidebarPresentation()} ${getRequestedExtensionSidebarDockSide()}`)
      );

      setExtensionSidebarPlacement('bottom', 'chat_menu');

      expect(seen).toEqual(['floating bottom', 'docked bottom']);
    });

    it('is the right, docked, for a plugin that cannot float or while the flag is off', () => {
      setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
      setExtensionSidebarPlacement('bottom', 'chat_menu');
      expect(getExtensionSidebarPlacement('grafana-pathfinder-app')).toBe('right');

      setTestFlags({});
      expect(getExtensionSidebarPlacement(ASSISTANT)).toBe('right');
    });

    it('docks on the right while the placements flag is off, though the sidebar can float', () => {
      setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
      setExtensionSidebarPlacement('left', 'chat_menu');

      setTestFlags({ [FLOATING_FLAG]: true });

      expect(canPlaceExtensionSidebar()).toBe(false);
      expect(getExtensionSidebarPlacement(ASSISTANT)).toBe('right');
      setExtensionSidebarPlacement('floating', 'chat_menu');
      expect(getExtensionSidebarPlacement(ASSISTANT)).toBe('floating');
    });
  });
});
