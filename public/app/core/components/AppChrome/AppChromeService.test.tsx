import { KioskMode } from 'app/types/dashboard';

import { AppChromeService } from './AppChromeService';

describe('AppChromeService', () => {
  it('Ignore state updates when sectionNav and pageNav have new instance but same text, url or active child', () => {
    const chromeService = new AppChromeService();
    let stateChanges = 0;

    chromeService.state.subscribe(() => stateChanges++);
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'A' },
    });
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'A' },
    });

    expect(stateChanges).toBe(2);

    // if url change we should update
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'new/url' },
    });
    expect(stateChanges).toBe(3);

    // if active child changed should update state
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'A', children: [{ text: 'child', active: true }] },
    });
    expect(stateChanges).toBe(4);

    // If active child is the same we should not update state
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'A', children: [{ text: 'child', active: true }] },
    });
    expect(stateChanges).toBe(4);
  });

  describe('setKioskModeFromUrl', () => {
    it('should set Full kiosk mode for kiosk=1', () => {
      const chromeService = new AppChromeService();
      chromeService.setKioskModeFromUrl('1');
      expect(chromeService.state.getValue().kioskMode).toBe(KioskMode.Full);
    });

    it('should set Full kiosk mode for kiosk=true', () => {
      const chromeService = new AppChromeService();
      chromeService.setKioskModeFromUrl(true);
      expect(chromeService.state.getValue().kioskMode).toBe(KioskMode.Full);
    });

    it('should set Embed kiosk mode for kiosk=embed', () => {
      const chromeService = new AppChromeService();
      chromeService.setKioskModeFromUrl('embed');
      expect(chromeService.state.getValue().kioskMode).toBe(KioskMode.Embed);
    });

    it('should not set kiosk mode for invalid value', () => {
      const chromeService = new AppChromeService();
      chromeService.setKioskModeFromUrl('invalid');
      expect(chromeService.state.getValue().kioskMode).toBeNull();
    });

    it('should not set chromeless for Embed kiosk mode', () => {
      const chromeService = new AppChromeService();
      chromeService.setKioskModeFromUrl('embed');
      expect(chromeService.state.getValue().chromeless).toBeFalsy();
    });

    it('should not set chromeless for null/undefined kiosk mode', () => {
      const chromeService = new AppChromeService();
      chromeService.setKioskModeFromUrl(null);
      expect(chromeService.state.getValue().kioskMode).toBeNull();
    });

    it('should set chromeless to true for Full kiosk mode', () => {
      const chromeService = new AppChromeService();
      chromeService.setKioskModeFromUrl('1');
      expect(chromeService.state.getValue().chromeless).toBe(true);
    });

    it('should not change kioskMode when same value is set again', () => {
      const chromeService = new AppChromeService();
      chromeService.setKioskModeFromUrl('embed');
      let stateChanges = 0;
      chromeService.state.subscribe(() => stateChanges++);
      chromeService.setKioskModeFromUrl('embed');
      // Should not emit a new state since value hasn't changed
      expect(stateChanges).toBe(1);
    });
  });

  describe('getKioskUrlValue', () => {
    it('should return true for Full kiosk mode', () => {
      const chromeService = new AppChromeService();
      expect(chromeService.getKioskUrlValue(KioskMode.Full)).toBe(true);
    });

    it('should return embed for Embed kiosk mode', () => {
      const chromeService = new AppChromeService();
      expect(chromeService.getKioskUrlValue(KioskMode.Embed)).toBe('embed');
    });

    it('should return null for null mode', () => {
      const chromeService = new AppChromeService();
      expect(chromeService.getKioskUrlValue(null)).toBeNull();
    });
  });
});
