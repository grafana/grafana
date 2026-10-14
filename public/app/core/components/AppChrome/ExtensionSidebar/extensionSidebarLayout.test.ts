import { setTestFlags } from '@grafana/test-utils/unstable';

import {
  canFloatExtensionSidebar,
  claimFloatingExtensionSidebar,
  getExtensionSidebarPresentation,
  getRequestedExtensionSidebarPresentation,
  notifyExtensionSidebarClosed,
  onExtensionSidebarClosed,
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

  describe('floating claims', () => {
    it('float the sidebar with the flag off until the last one is released', () => {
      const releaseFirst = claimFloatingExtensionSidebar();
      const releaseSecond = claimFloatingExtensionSidebar();
      expect(getExtensionSidebarPresentation()).toBe('floating');

      releaseFirst();
      releaseFirst();
      expect(getExtensionSidebarPresentation()).toBe('floating');

      releaseSecond();
      expect(getExtensionSidebarPresentation()).toBe('docked');
    });

    it("bring back the user's floating layout when released", () => {
      setTestFlags({ [FLOATING_FLAG]: true });
      setExtensionSidebarPresentation('floating');
      const release = claimFloatingExtensionSidebar();

      release();

      expect(getExtensionSidebarPresentation()).toBe('floating');
    });

    it('are withdrawn when the user docks the sidebar, after it has docked', () => {
      const seen: string[] = [];
      const onDocked = jest.fn(() => seen.push(getExtensionSidebarPresentation()));
      claimFloatingExtensionSidebar({ onDocked });

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
      expect(getExtensionSidebarPresentation()).toBe('floating');
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
