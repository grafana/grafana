import { __awaiter } from "tslib";
import { InventoryService } from 'app/percona/inventory/Inventory.service';
import { Databases } from 'app/percona/shared/core';
import { AddBackupPageService } from './AddBackupPage.service';
describe('AddBackupPageService', () => {
    it('should return only supported services', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(InventoryService, 'getDbServices').mockReturnValueOnce(Promise.resolve({
            postgresql: [{ id: 'psql1', name: 'postgres one' }],
            mongodb: [
                { id: 'mongo1', name: 'mongo one' },
                { id: 'mongo2', name: 'mongo two' },
            ],
            mysql: [{ id: 'mysql1', name: 'mysql one' }],
            proxysql: [{ id: 'proxysql1', name: 'proxysql one' }],
        }));
        const services = yield AddBackupPageService.loadServiceOptions('');
        const orderFn = (s1, s2) => { var _a, _b, _c; return (_c = (_a = s1.label) === null || _a === void 0 ? void 0 : _a.localeCompare((_b = s2.label) !== null && _b !== void 0 ? _b : '')) !== null && _c !== void 0 ? _c : 0; };
        expect(services.sort(orderFn)).toEqual([
            { label: 'mysql one', value: { id: 'mysql1', vendor: Databases.mysql } },
            { label: 'mongo one', value: { id: 'mongo1', vendor: Databases.mongodb } },
            { label: 'mongo two', value: { id: 'mongo2', vendor: Databases.mongodb } },
        ].sort(orderFn));
    }));
    it('should filter by service name', () => __awaiter(void 0, void 0, void 0, function* () {
        jest.spyOn(InventoryService, 'getDbServices').mockReturnValueOnce(Promise.resolve({
            postgresql: [{ id: 'psql1', name: 'postgres one' }],
            mongodb: [
                { id: 'mongo1', name: 'mongo one' },
                { id: 'mongo2', name: 'mongo two' },
            ],
            mysql: [{ id: 'mysql1', name: 'mysql one' }],
            proxysql: [{ id: 'proxysql1', name: 'proxysql one' }],
        }));
        const services = yield AddBackupPageService.loadServiceOptions('two');
        const orderFn = (s1, s2) => { var _a, _b, _c; return (_c = (_a = s1.label) === null || _a === void 0 ? void 0 : _a.localeCompare((_b = s2.label) !== null && _b !== void 0 ? _b : '')) !== null && _c !== void 0 ? _c : 0; };
        expect(services.sort(orderFn)).toEqual([{ label: 'mongo two', value: { id: 'mongo2', vendor: Databases.mongodb } }].sort(orderFn));
    }));
});
//# sourceMappingURL=AddBackupPage.service.test.js.map