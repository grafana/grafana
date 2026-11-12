import { locationService } from '@grafana/runtime';
import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';
import { contextSrv } from 'app/core/services/context_srv';

import { AppChromeService, getPageTitle } from './AppChromeService';

describe('AppChromeService', () => {
  it('does not read the location when login tab title preservation is disabled', () => {
    const originalSignedIn = contextSrv.user.isSignedIn;
    setTestFlags({ [FlagKeys.GrafanaPreserveLoginTabTitle]: false });
    contextSrv.user.isSignedIn = true;
    const readLocation = jest.spyOn(locationService, 'getLocation').mockImplementation(() => {
      throw new Error('Location is unavailable');
    });
    try {
      const chrome = new AppChromeService();
      const node = { id: 'explore', text: 'Explore' };
      chrome.update({ sectionNav: { node, main: node } });
      expect(chrome.state.getValue().sectionNav.node.id).toBe('explore');
      expect(readLocation).not.toHaveBeenCalled();
    } finally {
      readLocation.mockRestore();
      contextSrv.user.isSignedIn = originalSignedIn;
      setTestFlags({});
    }
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
    // A breadcrumb badge (highlightText) appearing or going away should update state
    chromeService.update({
      sectionNav: { node: { text: 'hello' }, main: { text: '' } },
      pageNav: { text: 'test', url: 'A', highlightText: 'Draft', children: [{ text: 'child', active: true }] },
    });
    expect(stateChanges).toBe(5);
  });

  describe('getPageTitle', () => {
    it('is the pageNav text, else the section text, and undefined until a page sets its nav after a route change', () => {
      const chromeService = new AppChromeService();
      expect(getPageTitle(chromeService.state.getValue())).toBeUndefined();

      chromeService.update({ sectionNav: { node: { text: 'Alert rules' }, main: { text: 'Alerting' } } });
      expect(getPageTitle(chromeService.state.getValue())).toBe('Alert rules');

      chromeService.update({ pageNav: { text: 'High CPU' } });
      expect(getPageTitle(chromeService.state.getValue())).toBe('High CPU');

      // A non-nav update after a route change clears the previous page's nav; no title until the new page sets one.
      chromeService.setMatchedRoute({ path: '/other', component: () => null });
      chromeService.update({ actions: null });
      expect(getPageTitle(chromeService.state.getValue())).toBeUndefined();
    });
  });
});
