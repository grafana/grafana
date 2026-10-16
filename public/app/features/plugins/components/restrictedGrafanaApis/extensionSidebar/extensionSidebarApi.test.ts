import { setTestFlags } from '@grafana/test-utils/unstable';
import {
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

    it('can float', () => {
      expect(extensionSidebarApi.canFloat()).toBe(true);
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

  describe('with grafana.extensionSidebarFloating off', () => {
    it('cannot float', () => {
      expect(extensionSidebarApi.canFloat()).toBe(false);
    });

    it('ignores floating and keeps the sidebar docked', () => {
      extensionSidebarApi.setPresentation('docked');
      extensionSidebarApi.setPresentation('floating');

      expect(getRequestedExtensionSidebarPresentation()).toBe('docked');
      expect(getEffectiveExtensionSidebarPresentation()).toBe('docked');
    });
  });
});
