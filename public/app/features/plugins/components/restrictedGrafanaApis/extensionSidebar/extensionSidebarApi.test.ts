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

const FLOATING_FLAG = 'grafana.extensionSidebarFloating';

describe('extensionSidebarApi', () => {
  afterEach(() => {
    resetExtensionSidebarPresentationForTests();
    setTestFlags({});
  });

  describe('with grafana.extensionSidebarFloating on', () => {
    beforeEach(() => setTestFlags({ [FLOATING_FLAG]: true }));

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
        extensionSidebarApi.setPlacement(placement === 'floating' ? 'left' : 'floating');
        const listener = jest.fn();
        const unsubscribe = extensionSidebarApi.subscribeToPlacement(listener);

        extensionSidebarApi.setPlacement(placement);

        expect(extensionSidebarApi.getPlacement()).toBe(placement);
        expect(listener).toHaveBeenCalled();
        unsubscribe();
      }
    );

    it('reports the placement core moved the sidebar to, as its own menu does', () => {
      setExtensionSidebarDockSide('bottom');
      setExtensionSidebarPresentation('docked');

      expect(extensionSidebarApi.getPlacement()).toBe('bottom');
    });

    it('ignores a value that is not a placement', () => {
      extensionSidebarApi.setPlacement('left');

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
      extensionSidebarApi.setPlacement('top' as 'left');

      expect(extensionSidebarApi.getPlacement()).toBe('left');
    });
  });

  it('with grafana.extensionSidebarFloating off, reports the right, where the sidebar docks, and moves it nowhere', () => {
    extensionSidebarApi.setPlacement('bottom');

    expect(extensionSidebarApi.getPlacement()).toBe('right');
    expect(getRequestedExtensionSidebarDockSide()).toBe('right');
  });

  it('stops telling a placement subscriber once it unsubscribes, and ignores one that is not a function', () => {
    setTestFlags({ [FLOATING_FLAG]: true });
    const listener = jest.fn();
    extensionSidebarApi.subscribeToPlacement(listener)();
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
    const unsubscribe = extensionSidebarApi.subscribeToPlacement('listener' as unknown as () => void);

    extensionSidebarApi.setPlacement('bottom');

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
    const listener = jest.fn();
    const unsubscribe = extensionSidebarApi.subscribeToPopOut(listener);
    expect(canPopOutExtensionSidebar()).toBe(true);

    popOutExtensionSidebar();
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    expect(canPopOutExtensionSidebar()).toBe(false);
  });

  it('marks the sidebar as in its own window until told otherwise, and asks the extension to bring it back', () => {
    const popIn = jest.fn();
    const stop = extensionSidebarApi.trackPopOut(popIn);
    expect(isExtensionSidebarPoppedOut()).toBe(true);

    popInExtensionSidebar();
    expect(popIn).toHaveBeenCalledTimes(1);

    stop();
    expect(isExtensionSidebarPoppedOut()).toBe(false);
  });

  it('ignores a pop-out tracker that is not a function', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
    const stop = extensionSidebarApi.trackPopOut('popIn' as unknown as () => void);

    expect(isExtensionSidebarPoppedOut()).toBe(false);
    expect(() => stop()).not.toThrow();
  });

  it('ignores a new window subscriber that is not a function', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- a plugin calling from untyped code
    const unsubscribe = extensionSidebarApi.subscribeToPopOut('listener' as unknown as () => void);

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
