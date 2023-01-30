import { AppChromeService } from './AppChromeService';

describe('AppChromeService', () => {
  it('onToggleKioskMode should set chromeless to true when searchbar is hidden', () => {
    const chromeService = new AppChromeService();
    chromeService.onToggleSearchBar();
    chromeService.onToggleKioskMode();
    expect(chromeService.state.getValue().chromeless).toBe(true);
  });

  it('Ignore state updates when sectionNav and pageNav is passed with new pageNav instance but same title', () => {
    const chromeService = new AppChromeService();
    let stateChanges = 0;

    chromeService.state.subscribe(() => stateChanges++);
    chromeService.update({ sectionNav: { text: 'hello' }, pageNav: { text: 'test' } });
    chromeService.update({ sectionNav: { text: 'hello' }, pageNav: { text: 'test' } });

    expect(stateChanges).toBe(2);
  });
});
