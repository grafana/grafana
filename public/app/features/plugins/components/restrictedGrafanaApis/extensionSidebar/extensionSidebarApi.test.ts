import { setTestFlags } from '@grafana/test-utils/unstable';
import {
  canCollapseFloatingExtensionSidebar,
  collapseFloatingExtensionSidebar,
  getEffectiveExtensionSidebarPresentation,
  getRequestedExtensionSidebarPresentation,
  resetExtensionSidebarPresentationForTests,
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
