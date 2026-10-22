import { store } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  canCollapseFloatingExtensionSidebar,
  canFloatExtensionSidebar,
  collapseFloatingExtensionSidebar,
  getRequestedExtensionSidebarPresentation,
  holdFloatingExtensionSidebar,
  isFloatingExtensionSidebarHeld,
  releaseFloatingExtensionSidebarHolds,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarPresentation,
  subscribeToExtensionSidebarPresentation,
  subscribeToFloatingExtensionSidebarCollapse,
} from './extensionSidebarLayout';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const FLOATING_FLAG = 'grafana.extensionSidebarFloating';
const PRESENTATION_KEY = 'grafana.navigation.extensionSidebarPresentation';
const LEGACY_PRESENTATION_KEY = 'grafana.navigation.extensionSidebarPresentationBySurface';

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

  it('floats by default', () => {
    expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
  });

  it('remembers one layout for every page', () => {
    setTestFlags({ [FLOATING_FLAG]: true });
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
      setTestFlags({ [FLOATING_FLAG]: true });
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

  it('reports each layout change, and nothing for an unchanged or refused one', () => {
    setExtensionSidebarPresentation('docked');
    setExtensionSidebarPresentation('docked');
    // Floating is refused while the flag is off.
    setExtensionSidebarPresentation('floating');
    setTestFlags({ [FLOATING_FLAG]: true });
    setExtensionSidebarPresentation('floating');
    setExtensionSidebarPresentation('floating');

    expect(jest.mocked(reportInteraction).mock.calls).toEqual([
      ['grafana_extension_sidebar_presentation_changed', { from: 'floating', to: 'docked' }],
      ['grafana_extension_sidebar_presentation_changed', { from: 'docked', to: 'floating' }],
    ]);
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
});
