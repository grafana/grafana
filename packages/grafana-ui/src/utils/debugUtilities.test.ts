import { attachDebugger, createLogger } from '@grafana/data';
import { attachDebugger as uiAttachDebugger, createLogger as uiCreateLogger } from '@grafana/ui';

import { attachDebugger as legacyAttachDebugger } from './debug';
import { createLogger as legacyCreateLogger } from './logger';

it('keeps data, UI public exports, and legacy UI paths on the same implementations', () => {
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
    const data = createLogger('data');
    const ui = uiCreateLogger('ui');
    const legacy = legacyCreateLogger('legacy');
    data.enable();
    ui.enable();
    legacy.enable();

    data.logger('first', true, 1);
    ui.logger('superseded', true, 2);
    legacy.logger('last', true, 3);
    expect(log.mock.calls).toEqual([['[data: first]:', 1]]);

    jest.advanceTimersByTime(499);
    expect(log.mock.calls).toEqual([['[data: first]:', 1]]);
    jest.advanceTimersByTime(1);
    expect(log.mock.calls).toEqual([
      ['[data: first]:', 1],
      ['[legacy: last]:', 3],
    ]);

    jest.advanceTimersByTime(500);
    ui.logger('next', true, 4);
    expect(log.mock.calls).toEqual([
      ['[data: first]:', 1],
      ['[legacy: last]:', 3],
      ['[ui: next]:', 4],
    ]);
  });
});
