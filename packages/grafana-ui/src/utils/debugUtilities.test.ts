import { attachDebugger as uiAttachDebugger, createLogger as uiCreateLogger } from '@grafana/ui';
import { attachDebugger, createLogger } from '@grafana/ui/debug';

import { attachDebugger as legacyAttachDebugger } from './debug';
import { createLogger as legacyCreateLogger } from './logger';

it('keeps narrow, public, and relative UI exports on the same implementations', () => {
  expect(uiCreateLogger).toBe(createLogger);
  expect(legacyCreateLogger).toBe(createLogger);
  expect(uiAttachDebugger).toBe(attachDebugger);
  expect(legacyAttachDebugger).toBe(attachDebugger);
});

describe('shared logger throttling', () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'development' });
    jest.useFakeTimers();
    log = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shares one leading/trailing 500ms throttle across logger instances and all import paths', () => {
    const narrow = createLogger('narrow');
    const ui = uiCreateLogger('ui');
    const legacy = legacyCreateLogger('legacy');
    narrow.enable();
    ui.enable();
    legacy.enable();

    narrow.logger('first', true, 1);
    ui.logger('superseded', true, 2);
    legacy.logger('last', true, 3);
    expect(log.mock.calls).toEqual([['[narrow: first]:', 1]]);

    jest.advanceTimersByTime(499);
    expect(log.mock.calls).toEqual([['[narrow: first]:', 1]]);
    jest.advanceTimersByTime(1);
    expect(log.mock.calls).toEqual([
      ['[narrow: first]:', 1],
      ['[legacy: last]:', 3],
    ]);

    jest.advanceTimersByTime(500);
    ui.logger('next', true, 4);
    expect(log.mock.calls).toEqual([
      ['[narrow: first]:', 1],
      ['[legacy: last]:', 3],
      ['[ui: next]:', 4],
    ]);
  });
});
