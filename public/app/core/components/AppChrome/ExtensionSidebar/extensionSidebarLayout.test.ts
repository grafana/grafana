import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  canFloatExtensionSidebar,
  getRequestedExtensionSidebarPresentation,
  resetExtensionSidebarPresentationForTests,
  setExtensionSidebarPresentation,
  subscribeToExtensionSidebarPresentation,
} from './extensionSidebarLayout';

const FLOATING_FLAG = 'grafana.extensionSidebarFloating';

describe('extensionSidebarLayout', () => {
  afterEach(() => {
    resetExtensionSidebarPresentationForTests();
    setTestFlags({});
  });

  it('floats only while the flag is on', () => {
    expect(canFloatExtensionSidebar()).toBe(false);
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

  it('notifies subscribers only when the layout changes', () => {
    setTestFlags({ [FLOATING_FLAG]: true });
    const listener = jest.fn();
    const unsubscribe = subscribeToExtensionSidebarPresentation(listener);

    setExtensionSidebarPresentation('floating');
    setExtensionSidebarPresentation('floating');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setExtensionSidebarPresentation('docked');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
