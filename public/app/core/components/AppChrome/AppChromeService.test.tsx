import { reportInteraction } from '@grafana/runtime';

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
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('setFullscreenWorkspace updates state and reports enter/exit', () => {
      const chromeService = new AppChromeService();

      chromeService.setFullscreenWorkspace(true);
      expect(chromeService.state.getValue().fullscreenWorkspace).toBe(true);
      expect(reportInteractionMock).toHaveBeenCalledWith('grafana_fullscreen_workspace', { action: 'enter' });

      chromeService.setFullscreenWorkspace(false);
      expect(chromeService.state.getValue().fullscreenWorkspace).toBe(false);
      expect(reportInteractionMock).toHaveBeenCalledWith('grafana_fullscreen_workspace', { action: 'exit' });
    });

    it('toggleFullscreenWorkspace flips the current state', () => {
      const chromeService = new AppChromeService();
      const initial = chromeService.state.getValue().fullscreenWorkspace ?? false;

      chromeService.toggleFullscreenWorkspace();
      expect(chromeService.state.getValue().fullscreenWorkspace).toBe(!initial);

      chromeService.toggleFullscreenWorkspace();
      expect(chromeService.state.getValue().fullscreenWorkspace).toBe(initial);
    });
  });
});
