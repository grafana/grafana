import { AppChromeService } from './AppChromeService';

describe('AppChromeService', () => {
  it('onToggleKioskMode should set chromeless to true when searchbar is hidden', () => {
    const chromeService = new AppChromeService();
    chromeService.onToggleSearchBar();
    chromeService.onToggleKioskMode();
    expect(chromeService.state.getValue().chromeless).toBe(true);
  });

  it('onToggleSearchBar should clear kiosk mode', () => {
    const chromeService = new AppChromeService();
    chromeService.onToggleKioskMode();
    chromeService.onToggleSearchBar();
    expect(chromeService.state.getValue().kioskMode).toBeFalsy();
  });

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
});
