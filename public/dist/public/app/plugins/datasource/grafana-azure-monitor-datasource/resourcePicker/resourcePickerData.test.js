import { __assign, __awaiter, __generator } from "tslib";
import ResourcePickerData from './resourcePickerData';
import { createMockARGResourceContainersResponse, createARGResourcesResponse, } from '../__mocks__/argResourcePickerResponse';
import { ResourceRowType } from '../components/ResourcePicker/types';
import { createMockInstanceSetttings } from '../__mocks__/instanceSettings';
var instanceSettings = createMockInstanceSetttings();
var resourcePickerData = new ResourcePickerData(instanceSettings);
var postResource;
describe('AzureMonitor resourcePickerData', function () {
    describe('getResourcePickerData', function () {
        beforeEach(function () {
            postResource = jest.fn().mockResolvedValue(createMockARGResourceContainersResponse());
            resourcePickerData.postResource = postResource;
        });
        it('calls ARG API', function () { return __awaiter(void 0, void 0, void 0, function () {
            var argQuery;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, resourcePickerData.getResourcePickerData()];
                    case 1:
                        _a.sent();
                        expect(postResource).toHaveBeenCalled();
                        argQuery = postResource.mock.calls[0][1].query;
                        expect(argQuery).toContain("where type == 'microsoft.resources/subscriptions'");
                        expect(argQuery).toContain("where type == 'microsoft.resources/subscriptions/resourcegroups'");
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns only subscriptions at the top level', function () { return __awaiter(void 0, void 0, void 0, function () {
            var results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, resourcePickerData.getResourcePickerData()];
                    case 1:
                        results = _a.sent();
                        expect(results.map(function (v) { return v.id; })).toEqual(['/subscriptions/abc-123', '/subscription/def-456']);
                        return [2 /*return*/];
                }
            });
        }); });
        it('nests resource groups under their subscriptions', function () { return __awaiter(void 0, void 0, void 0, function () {
            var results;
            var _a, _b;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, resourcePickerData.getResourcePickerData()];
                    case 1:
                        results = _c.sent();
                        expect((_a = results[0].children) === null || _a === void 0 ? void 0 : _a.map(function (v) { return v.id; })).toEqual([
                            '/subscriptions/abc-123/resourceGroups/prod',
                            '/subscriptions/abc-123/resourceGroups/pre-prod',
                        ]);
                        expect((_b = results[1].children) === null || _b === void 0 ? void 0 : _b.map(function (v) { return v.id; })).toEqual([
                            '/subscription/def-456/resourceGroups/dev',
                            '/subscription/def-456/resourceGroups/test',
                            '/subscription/def-456/resourceGroups/qa',
                        ]);
                        return [2 /*return*/];
                }
            });
        }); });
        describe('when there is more than one page', function () {
            beforeEach(function () {
                var response1 = __assign(__assign({}, createMockARGResourceContainersResponse()), { $skipToken: 'aaa' });
                var response2 = createMockARGResourceContainersResponse();
                postResource = jest.fn();
                postResource.mockResolvedValueOnce(response1);
                postResource.mockResolvedValueOnce(response2);
                resourcePickerData.postResource = postResource;
            });
            it('should requests additional pages', function () { return __awaiter(void 0, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, resourcePickerData.getResourcePickerData()];
                        case 1:
                            _a.sent();
                            expect(postResource).toHaveBeenCalledTimes(2);
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should use the skipToken of the previous page', function () { return __awaiter(void 0, void 0, void 0, function () {
                var secondCall;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, resourcePickerData.getResourcePickerData()];
                        case 1:
                            _a.sent();
                            secondCall = postResource.mock.calls[1];
                            expect(secondCall[1]).toMatchObject({ options: { $skipToken: 'aaa', resultFormat: 'objectArray' } });
                            return [2 /*return*/];
                    }
                });
            }); });
            it('should combine responses', function () { return __awaiter(void 0, void 0, void 0, function () {
                var results;
                var _a, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0: return [4 /*yield*/, resourcePickerData.getResourcePickerData()];
                        case 1:
                            results = _c.sent();
                            expect((_a = results[0].children) === null || _a === void 0 ? void 0 : _a.map(function (v) { return v.id; })).toEqual([
                                '/subscriptions/abc-123/resourceGroups/prod',
                                '/subscriptions/abc-123/resourceGroups/pre-prod',
                                // second page
                                '/subscriptions/abc-123/resourceGroups/prod',
                                '/subscriptions/abc-123/resourceGroups/pre-prod',
                            ]);
                            expect((_b = results[1].children) === null || _b === void 0 ? void 0 : _b.map(function (v) { return v.id; })).toEqual([
                                '/subscription/def-456/resourceGroups/dev',
                                '/subscription/def-456/resourceGroups/test',
                                '/subscription/def-456/resourceGroups/qa',
                                // second page
                                '/subscription/def-456/resourceGroups/dev',
                                '/subscription/def-456/resourceGroups/test',
                                '/subscription/def-456/resourceGroups/qa',
                            ]);
                            return [2 /*return*/];
                    }
                });
            }); });
        });
    });
    describe('getResourcesForResourceGroup', function () {
        var resourceRow = {
            id: '/subscription/def-456/resourceGroups/dev',
            name: 'Dev',
            type: ResourceRowType.ResourceGroup,
            typeLabel: 'Resource group',
        };
        beforeEach(function () {
            postResource = jest.fn().mockResolvedValue(createARGResourcesResponse());
            resourcePickerData.postResource = postResource;
        });
        it('requests resources for the specified resource row', function () { return __awaiter(void 0, void 0, void 0, function () {
            var argQuery;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, resourcePickerData.getResourcesForResourceGroup(resourceRow)];
                    case 1:
                        _a.sent();
                        expect(postResource).toHaveBeenCalled();
                        argQuery = postResource.mock.calls[0][1].query;
                        expect(argQuery).toContain(resourceRow.id);
                        return [2 /*return*/];
                }
            });
        }); });
        it('returns formatted resources', function () { return __awaiter(void 0, void 0, void 0, function () {
            var results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, resourcePickerData.getResourcesForResourceGroup(resourceRow)];
                    case 1:
                        results = _a.sent();
                        expect(results.map(function (v) { return v.id; })).toEqual([
                            '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/web-server',
                            '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/web-server_DataDisk',
                            '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/virtualMachines/db-server',
                            '/subscription/def-456/resourceGroups/dev/providers/Microsoft.Compute/disks/db-server_DataDisk',
                        ]);
                        results.forEach(function (v) { return expect(v.type).toEqual(ResourceRowType.Resource); });
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
//# sourceMappingURL=resourcePickerData.test.js.map