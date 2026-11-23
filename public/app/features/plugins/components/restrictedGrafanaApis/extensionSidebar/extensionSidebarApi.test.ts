import { reportInteraction } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';
import {
  canCollapseFloatingExtensionSidebar,
  canPopOutExtensionSidebar,
  collapseFloatingExtensionSidebar,
  getEffectiveExtensionSidebarPresentation,
  getRequestedExtensionSidebarDockSide,
  getRequestedExtensionSidebarPresentation,
  isExtensionSidebarPoppedOut,
  popInExtensionSidebar,
  popOutExtensionSidebar,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarDockSide,
  setExtensionSidebarPresentation,
} from 'app/core/components/AppChrome/ExtensionSidebar/extensionSidebarLayout';

import { extensionSidebarApi } from './extensionSidebarApi';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const FLOATING_FLAG = 'grafana.extensionSidebarFloating';

/** The placement changes reported, without the event name. */
const reportedPlacementChanges = () =>
  jest
    .mocked(reportInteraction)
    .mock.calls.filter(([name]) => name === 'grafana_extension_sidebar_placement_changed')
    .map(([, properties]) => properties);

const PLACEMENTS_FLAG = 'grafana.extensionSidebarPlacements';

/** The members present while placements are on; fails the test where they are absent. */
function placementApi() {
  const { getPlacement, setPlacement, subscribeToPlacement, subscribeToPopOut, trackPopOut } = extensionSidebarApi;
  if (!getPlacement || !setPlacement || !subscribeToPlacement || !subscribeToPopOut || !trackPopOut) {
    throw new Error('The placement members are absent');
  }
  return { getPlacement, setPlacement, subscribeToPlacement, subscribeToPopOut, trackPopOut };
}

describe('extensionSidebarApi', () => {
  afterEach(() => {
    resetExtensionSidebarPresentationForTests();
    setTestFlags({});
    jest.mocked(reportInteraction).mockClear();
  });

  describe('with grafana.extensionSidebarFloating on', () => {
    beforeEach(() => setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true }));

    it('can float, also by dragging out of the docked sidebar', () => {
      expect(extensionSidebarApi.canFloat()).toBe(true);
      expect(extensionSidebarApi.canDragToFloat()).toBe(true);
    });

    it('floats and docks the sidebar', () => {
      extensionSidebarApi.setPresentation('floating');
      expect(getRequestedExtensionSidebarPresentation()).toBe('floating');

      extensionSidebarApi.setPresentation('docked');
      expect(getRequestedExtensionSidebarPresentation()).toBe('docked');
    });

    it('reports a move it makes as made by the plugin, docking on the side it last docked on', () => {
      setExtensionSidebarDockSide('bottom');

      extensionSidebarApi.setPresentation('docked');
      placementApi().setPlacement('left');

      expect(reportedPlacementChanges()).toEqual([
        { placement: 'bottom', previous_placement: 'floating', source: 'plugin' },
        { placement: 'left', previous_placement: 'bottom', source: 'plugin' },
      ]);
    });

    it('ignores a value that is not a layout', () => {
      extensionSidebarApi.setPresentation('floating');

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
      extensionSidebarApi.setPresentation('hidden' as 'docked');

      expect(getRequestedExtensionSidebarPresentation()).toBe('floating');
    });

    it.each(['left', 'right', 'bottom', 'floating'] as const)(
      'moves the sidebar %s and reports it there, telling subscribers',
      (placement) => {
        // Starts away from every placement it is moved to.
        placementApi().setPlacement(placement === 'floating' ? 'left' : 'floating');
        const listener = jest.fn();
        const unsubscribe = placementApi().subscribeToPlacement(listener);

        placementApi().setPlacement(placement);

        expect(placementApi().getPlacement()).toBe(placement);
        expect(listener).toHaveBeenCalled();
        unsubscribe();
      }
    );

    it('reports the placement core moved the sidebar to, as its own menu does', () => {
      setExtensionSidebarDockSide('bottom');
      setExtensionSidebarPresentation('docked');

      expect(placementApi().getPlacement()).toBe('bottom');
    });

    it('ignores a value that is not a placement', () => {
      placementApi().setPlacement('left');

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
      placementApi().setPlacement('top' as 'left');

      expect(placementApi().getPlacement()).toBe('left');
    });
  });

  it.each([
    ['both flags off', {}],
    ['only floating on', { [FLOATING_FLAG]: true }],
    ['only placements on', { [PLACEMENTS_FLAG]: true }],
  ])('offers no placement or pop-out members with %s, so an extension keeps its own controls', (_case, flags) => {
    setTestFlags(flags);

    expect(extensionSidebarApi.getPlacement).toBeUndefined();
    expect(extensionSidebarApi.setPlacement).toBeUndefined();
    expect(extensionSidebarApi.subscribeToPlacement).toBeUndefined();
    expect(extensionSidebarApi.subscribeToPopOut).toBeUndefined();
    expect(extensionSidebarApi.trackPopOut).toBeUndefined();
    expect(getRequestedExtensionSidebarDockSide()).toBe('right');
  });

  it('stops telling a placement subscriber once it unsubscribes, and ignores one that is not a function', () => {
    setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
    const listener = jest.fn();
    placementApi().subscribeToPlacement(listener)();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
    const unsubscribe = placementApi().subscribeToPlacement('listener' as unknown as () => void);

    placementApi().setPlacement('bottom');

    expect(listener).not.toHaveBeenCalled();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('tells subscribers when the user asks to collapse the floating sidebar, until they unsubscribe', () => {
    const listener = jest.fn();
    expect(canCollapseFloatingExtensionSidebar()).toBe(false);
    const unsubscribe = extensionSidebarApi.subscribeToCollapse(listener);
    expect(canCollapseFloatingExtensionSidebar()).toBe(true);

    collapseFloatingExtensionSidebar();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(canCollapseFloatingExtensionSidebar()).toBe(false);
    collapseFloatingExtensionSidebar();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores a collapse subscriber that is not a function', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
    const unsubscribe = extensionSidebarApi.subscribeToCollapse('listener' as unknown as () => void);

    expect(() => collapseFloatingExtensionSidebar()).not.toThrow();
    expect(() => unsubscribe()).not.toThrow();
  });

  it('tells subscribers when the user asks to open the sidebar in a new window, until they unsubscribe', () => {
    setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
    const listener = jest.fn();
    const unsubscribe = placementApi().subscribeToPopOut(listener);
    expect(canPopOutExtensionSidebar()).toBe(true);

    popOutExtensionSidebar();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(canPopOutExtensionSidebar()).toBe(false);
  });

  it('marks the sidebar as in its own window until told otherwise, and asks the extension to bring it back', () => {
    setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
    const popIn = jest.fn();
    const stop = placementApi().trackPopOut(popIn);
    expect(isExtensionSidebarPoppedOut()).toBe(true);

    popInExtensionSidebar();
    expect(popIn).toHaveBeenCalledTimes(1);

    stop();
    expect(isExtensionSidebarPoppedOut()).toBe(false);
  });

  it('ignores a pop-out tracker that is not a function', () => {
    setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
    const stop = placementApi().trackPopOut('popIn' as unknown as () => void);

    expect(isExtensionSidebarPoppedOut()).toBe(false);
    expect(() => stop()).not.toThrow();
  });

  it('ignores a new window subscriber that is not a function', () => {
    setTestFlags({ [FLOATING_FLAG]: true, [PLACEMENTS_FLAG]: true });
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
    const unsubscribe = placementApi().subscribeToPopOut('listener' as unknown as () => void);

    expect(canPopOutExtensionSidebar()).toBe(false);
    expect(() => unsubscribe()).not.toThrow();
  });

  describe('with grafana.extensionSidebarFloating off', () => {
    it('cannot float, not even by dragging', () => {
      expect(extensionSidebarApi.canFloat()).toBe(false);
      expect(extensionSidebarApi.canDragToFloat()).toBe(false);
    });

    it('ignores floating and keeps the sidebar docked', () => {
      extensionSidebarApi.setPresentation('docked');
      extensionSidebarApi.setPresentation('floating');

      expect(getRequestedExtensionSidebarPresentation()).toBe('docked');
      expect(getEffectiveExtensionSidebarPresentation('grafana-assistant-app')).toBe('docked');
    });
  });
});
