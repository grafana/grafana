import { setCustomNamespace } from './setQueryValue';
describe('setQueryValue', () => {
    describe('setCustomNamespace', () => {
        it('The metricnamespace must be: microsoft.storage/storageaccounts for storage accounts.', () => {
            var _a, _b;
            const result = setCustomNamespace({ refId: 'A' }, 'microsoft.storage/storageaccounts/fileservices');
            expect((_a = result.azureMonitor) === null || _a === void 0 ? void 0 : _a.customNamespace).toBeUndefined();
            expect((_b = result.azureMonitor) === null || _b === void 0 ? void 0 : _b.metricNamespace).toEqual('microsoft.storage/storageaccounts/fileservices');
        });
        it('Set a custom namespace for non storage accounts.', () => {
            var _a;
            const result = setCustomNamespace({ refId: 'A' }, 'foo/bar');
            expect((_a = result.azureMonitor) === null || _a === void 0 ? void 0 : _a.customNamespace).toEqual('foo/bar');
        });
    });
});
//# sourceMappingURL=setQueryValue.test.js.map