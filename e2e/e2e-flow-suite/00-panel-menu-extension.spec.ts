import { e2e } from '../utils';

describe('Panel menu ui extension flow', () => {
  beforeEach(() => {
    e2e.flows.login(e2e.env('USERNAME'), e2e.env('PASSWORD'));
  });

  it('Should be possible to click extension menu item', () => {
    const panelTitle = 'Random walk series';
    const extensionTitle = 'Copy';

    e2e.flows.openDashboard({ uid: '5SdHCasdf' });
    e2e.flows.openPanelMenuExtension(extensionTitle, panelTitle);
    e2e.flows.assertSuccessNotification();
  });
});
