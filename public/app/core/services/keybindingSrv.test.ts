import { LocationService } from '@grafana/runtime';
import { KioskMode } from 'app/types';

import { AppChromeService } from '../components/AppChrome/AppChromeService';

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
      // Set embed kiosk mode
      chromeService.update({ kioskMode: KioskMode.Embed });
      const exitSpy = jest.spyOn(chromeService, 'exitKioskMode');

      // Trigger escape (calls private exit method via keybinding)
      // We need to access the private method - use bracket notation
      (keybindingSrv as any).exit();

      expect(exitSpy).not.toHaveBeenCalled();
    });

    it('should exit kiosk mode when in Full mode', () => {
      // Set full kiosk mode
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
