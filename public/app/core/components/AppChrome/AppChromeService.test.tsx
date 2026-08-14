import { locationService, reportInteraction } from '@grafana/runtime';

import { AppChromeService } from './AppChromeService';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

const reportInteractionMock = jest.mocked(reportInteraction);

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

  describe('fullscreen workspace', () => {
    // `locationService` is a module singleton, and entering leaves the collapse mode and a
    // history listener on it, so every test tears down through the service's own exit path.
    const history = locationService.getHistory();
    let chromeService: AppChromeService;

    beforeEach(() => {
      jest.clearAllMocks();
      chromeService = new AppChromeService();
      history.push('/before-workspace');
    });

    afterEach(() => {
      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: false });
    });

    it('entering pushes the entry back pops, and collapses navigation made inside', () => {
      const lengthBefore = history.length;

      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: true });
      expect(history.length).toBe(lengthBefore + 1);

      // Platform-tab navigation replaces the workspace's entry instead of stacking.
      history.push('/inside-workspace');
      expect(history.length).toBe(lengthBefore + 1);

      history.goBack();
      expect(locationService.getLocation().pathname).toBe('/before-workspace');
    });

    it('closes the workspace when the user goes back', () => {
      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: true });
      history.push('/inside-workspace');

      history.goBack();

      expect(chromeService.state.getValue().fullscreenWorkspace).toBe(false);
      expect(reportInteractionMock).toHaveBeenLastCalledWith('grafana_fullscreen_workspace', { action: 'exit' });
    });

    it('exiting keeps the current url and stops collapsing', () => {
      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: true });
      history.push('/inside-workspace');

      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: false });

      // The page the Platform tab was showing stays on screen after exit.
      expect(locationService.getLocation().pathname).toBe('/inside-workspace');
      const lengthAfterExit = history.length;
      history.push('/after-workspace');
      expect(history.length).toBe(lengthAfterExit + 1);
    });

    it('stops closing the workspace on back once it has been exited', () => {
      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: true });
      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: false });
      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: true });

      // The listener from the first entry must not still be attached, or this back would
      // fire it twice — harmless today, but it would leak a listener per entry.
      history.goBack();

      expect(chromeService.state.getValue().fullscreenWorkspace).toBe(false);
    });

    it('does not push when the caller arrived by navigating, so back reaches the page before it', () => {
      // Stands in for the `?fullscreenWorkspace=1` redirect: a navigation created this entry.
      history.push('/workspace-entry');
      const lengthOnEntry = history.length;

      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: true, pushHistoryEntry: false });
      history.push('/inside-workspace');

      expect(history.length).toBe(lengthOnEntry);
      history.goBack();
      expect(locationService.getLocation().pathname).toBe('/before-workspace');
    });

    it('is a no-op when already in the requested state, so back still takes one press', () => {
      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: true });
      const lengthAfterEnter = history.length;
      reportInteractionMock.mockClear();

      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: true });

      expect(history.length).toBe(lengthAfterEnter);
      expect(reportInteractionMock).not.toHaveBeenCalled();
    });

    it('setFullscreenWorkspace updates state and reports enter/exit', () => {
      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: true });
      expect(chromeService.state.getValue().fullscreenWorkspace).toBe(true);
      expect(reportInteractionMock).toHaveBeenCalledWith('grafana_fullscreen_workspace', { action: 'enter' });

      chromeService.setFullscreenWorkspace({ fullscreenWorkspace: false });
      expect(chromeService.state.getValue().fullscreenWorkspace).toBe(false);
      expect(reportInteractionMock).toHaveBeenCalledWith('grafana_fullscreen_workspace', { action: 'exit' });
    });

    it('toggleFullscreenWorkspace flips the current state', () => {
      const initial = chromeService.state.getValue().fullscreenWorkspace ?? false;

      chromeService.toggleFullscreenWorkspace();
      expect(chromeService.state.getValue().fullscreenWorkspace).toBe(!initial);

      chromeService.toggleFullscreenWorkspace();
      expect(chromeService.state.getValue().fullscreenWorkspace).toBe(initial);
    });
  });
});
