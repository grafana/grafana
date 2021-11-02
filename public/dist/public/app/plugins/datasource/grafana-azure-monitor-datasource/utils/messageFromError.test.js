import { invalidNamespaceError } from '../__mocks__/errors';
import messageFromError from './messageFromError';
describe('AzureMonitor: messageFromError', function () {
    it('returns message from Error exception', function () {
        var err = new Error('wowee an error');
        expect(messageFromError(err)).toBe('wowee an error');
    });
    it('returns message from Azure API error', function () {
        var err = invalidNamespaceError();
        expect(messageFromError(err)).toBe("The resource namespace 'grafanadev' is invalid.");
    });
});
//# sourceMappingURL=messageFromError.test.js.map