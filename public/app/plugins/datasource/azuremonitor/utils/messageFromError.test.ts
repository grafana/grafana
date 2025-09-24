import { invalidNamespaceError } from '../mocks/errors';

import messageFromError from './messageFromError';

describe('AzureMonitor: messageFromError', () => {
  it('returns message from Error exception', () => {
    const err = new Error('wowee an error');
    expect(messageFromError(err)).toBe('wowee an error');
  });

  it('returns message from Azure API error', () => {
    const err = invalidNamespaceError();
    expect(messageFromError(err)).toBe("The resource namespace 'grafanadev' is invalid.");
  });
});
