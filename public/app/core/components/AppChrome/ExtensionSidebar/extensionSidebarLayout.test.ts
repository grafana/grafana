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
});
