import { LocationService } from '@grafana/runtime';
import { KioskMode } from 'app/types/dashboard';

import { AppChromeService } from '../components/AppChrome/AppChromeService';

jest.mock('app/core/utils/explore', () => ({ getExploreUrl: jest.fn() }));
jest.mock('app/features/dashboard/components/SaveDashboard/SaveDashboardDrawer', () => ({}));
jest.mock('app/features/dashboard/components/ShareModal/ShareModal', () => ({}));
jest.mock('app/features/dashboard/state/DashboardModel', () => ({}));
jest.mock('../../features/dashboard/services/TimeSrv', () => ({ getTimeSrv: jest.fn() }));
jest.mock('app/dev-utils', () => ({ toggleMockApiAndReload: jest.fn(), togglePseudoLocale: jest.fn() }));
jest.mock('./theme', () => ({ toggleTheme: jest.fn() }));
jest.mock('./mousetrap', () => ({ mousetrap: { bind: jest.fn(), unbind: jest.fn() } }));
jest.mock('@grafana/assistant', () => ({ toggleAssistant: jest.fn(), isAssistantAvailable: jest.fn() }));
jest.mock('../components/help/HelpModal', () => ({}));

import { KeybindingSrv } from './keybindingSrv';

describe('KeybindingSrv', () => {
  describe('escape key and kiosk mode', () => {
    let keybindingSrv: KeybindingSrv;
    let chromeService: AppChromeService;
    let locationService: LocationService;

    beforeEach(() => {
      locationService = {
        getSearchObject: jest.fn().mockReturnValue({}),
        partial: jest.fn(),
        push: jest.fn(),
        getLocation: jest.fn().mockReturnValue({ pathname: '/', search: '' }),
      } as unknown as LocationService;

      chromeService = new AppChromeService();
      keybindingSrv = new KeybindingSrv(locationService, chromeService);
    });

    it('should not exit kiosk mode when in Embed mode', () => {
      chromeService.update({ kioskMode: KioskMode.Embed });
      const exitSpy = jest.spyOn(chromeService, 'exitKioskMode');

      (keybindingSrv as any).exit();

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should exit kiosk mode when in Full mode', () => {
      chromeService.update({ kioskMode: KioskMode.Full });
      const exitSpy = jest.spyOn(chromeService, 'exitKioskMode');

      (keybindingSrv as any).exit();

      expect(exitSpy).toHaveBeenCalled();
    });

    it('should not call exitKioskMode when no kiosk mode is active', () => {
      const exitSpy = jest.spyOn(chromeService, 'exitKioskMode');

      (keybindingSrv as any).exit();

      expect(exitSpy).not.toHaveBeenCalled();
    });
  });
});
