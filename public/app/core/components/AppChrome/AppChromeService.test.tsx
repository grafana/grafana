import { AppChromeService } from './AppChromeService';

describe('AppChromeService', () => {
  it('onToggleKioskMode should set chromeless to true when searchbar is hidden', () => {
    const chromeService = new AppChromeService();
    chromeService.onToggleSearchBar();
    chromeService.onToggleKioskMode();
    expect(chromeService.state.getValue().chromeless).toBe(true);
  });
});
