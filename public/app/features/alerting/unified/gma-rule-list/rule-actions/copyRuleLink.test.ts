import { userEvent } from 'test/test-utils';

import { appEvents } from 'app/core/app_events';

import { copyRuleLink } from './copyRuleLink';

describe('copyRuleLink', () => {
  beforeEach(() => {
    // user-event installs the clipboard stub that jsdom lacks.
    userEvent.setup();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes the URL to the clipboard and confirms', async () => {
    const writeText = jest.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const emit = jest.spyOn(appEvents, 'emit');

    await copyRuleLink('alert', 'http://localhost/rule');

    expect(writeText).toHaveBeenCalledWith('http://localhost/rule');
    expect(emit).toHaveBeenCalledWith('alert-success', ['URL copied to clipboard']);
  });

  it('reports a failure when the clipboard write rejects', async () => {
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    const emit = jest.spyOn(appEvents, 'emit');

    await copyRuleLink('alert', 'http://localhost/rule');

    expect(emit).toHaveBeenCalledWith('alert-error', ['Could not copy URL to clipboard']);
    expect(emit).not.toHaveBeenCalledWith('alert-success', expect.anything());
  });

  it('reports a failure when the clipboard is unavailable', async () => {
    const emit = jest.spyOn(appEvents, 'emit');
    const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    try {
      await copyRuleLink('recording', 'http://localhost/rule');
    } finally {
      if (clipboard) {
        Object.defineProperty(navigator, 'clipboard', clipboard);
      }
    }

    expect(emit).toHaveBeenCalledWith('alert-error', ['Could not copy URL to clipboard']);
  });
});
