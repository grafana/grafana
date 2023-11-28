import { __awaiter } from "tslib";
import { dimensionVariable, fieldsVariable, labelsVariable, setupMockedDataSource, } from './__mocks__/CloudWatchDataSource';
import { setupMockedResourcesAPI } from './__mocks__/ResourcesAPI';
import { VariableQueryType } from './types';
import { CloudWatchVariableSupport } from './variables';
const defaultQuery = {
    queryType: VariableQueryType.Regions,
    namespace: 'foo',
    region: 'bar',
    metricName: '',
    dimensionKey: '',
    instanceID: '',
    attributeName: '',
    resourceType: '',
    refId: '',
};
const mock = setupMockedDataSource({ variables: [labelsVariable, dimensionVariable, fieldsVariable] });
mock.datasource.resources.getRegions = jest.fn().mockResolvedValue([{ label: 'a', value: 'a' }]);
mock.datasource.resources.getNamespaces = jest.fn().mockResolvedValue([{ label: 'b', value: 'b' }]);
mock.datasource.resources.getAccounts = jest.fn().mockResolvedValue([]);
const getMetrics = jest.fn().mockResolvedValue([{ label: 'c', value: 'c' }]);
const getDimensionKeys = jest.fn().mockResolvedValue([{ label: 'd', value: 'd' }]);
const getDimensionValues = jest.fn().mockResolvedValue([{ label: 'e', value: 'e' }]);
const getEbsVolumeIds = jest.fn().mockResolvedValue([{ label: 'f', value: 'f' }]);
const getEc2InstanceAttribute = jest.fn().mockResolvedValue([{ label: 'g', value: 'g' }]);
const getResourceARNs = jest.fn().mockResolvedValue([{ label: 'h', value: 'h' }]);
const getLogGroups = jest
    .fn()
    .mockResolvedValue([{ value: { arn: 'a', name: 'a' } }, { value: { arn: 'b', name: 'b' } }]);
const variables = new CloudWatchVariableSupport(mock.datasource.resources);
describe('variables', () => {
    it('should run regions', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield variables.execute(Object.assign({}, defaultQuery));
        expect(result).toEqual([{ text: 'a', value: 'a', expandable: true }]);
    }));
    it('should run namespaces', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield variables.execute(Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.Namespaces }));
        expect(result).toEqual([{ text: 'b', value: 'b', expandable: true }]);
    }));
    it('should run metrics', () => __awaiter(void 0, void 0, void 0, function* () {
        mock.datasource.resources.getMetrics = getMetrics;
        const query = Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.Metrics, accountId: '123' });
        const result = yield variables.execute(query);
        expect(getMetrics).toBeCalledWith({
            region: query.region,
            namespace: 'foo',
            accountId: query.accountId,
        });
        expect(result).toEqual([{ text: 'c', value: 'c', expandable: true }]);
    }));
    it('should run dimension keys', () => __awaiter(void 0, void 0, void 0, function* () {
        mock.datasource.resources.getDimensionKeys = getDimensionKeys;
        const query = Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.DimensionKeys, accountId: '123' });
        const result = yield variables.execute(query);
        expect(getDimensionKeys).toBeCalledWith({
            region: query.region,
            namespace: query.namespace,
            accountId: query.accountId,
        });
        expect(result).toEqual([{ text: 'd', value: 'd', expandable: true }]);
    }));
    describe('accounts', () => {
        it('should run accounts', () => __awaiter(void 0, void 0, void 0, function* () {
            const { api } = setupMockedResourcesAPI();
            const getAccountMock = jest.fn().mockResolvedValue([]);
            api.getAccounts = getAccountMock;
            const variables = new CloudWatchVariableSupport(api);
            yield variables.execute(Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.Accounts }));
            expect(getAccountMock).toHaveBeenCalledWith({ region: defaultQuery.region });
        }));
        it('should map accounts to metric find value and insert "all" option', () => __awaiter(void 0, void 0, void 0, function* () {
            const { api } = setupMockedResourcesAPI();
            api.getAccounts = jest.fn().mockResolvedValue([{ id: '123', label: 'Account1' }]);
            const variables = new CloudWatchVariableSupport(api);
            const result = yield variables.execute(Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.Accounts }));
            expect(result).toEqual([
                { text: 'All', value: 'all', expandable: true },
                { text: 'Account1', value: '123', expandable: true },
            ]);
        }));
    });
    describe('dimension values', () => {
        const query = Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.DimensionValues, metricName: 'abc', dimensionKey: 'efg', dimensionFilters: { a: 'b' }, accountId: '123' });
        beforeEach(() => {
            mock.datasource.resources.getDimensionValues = getDimensionValues;
            getDimensionValues.mockClear();
        });
        it('should not run if dimension key not set', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield variables.execute(Object.assign(Object.assign({}, query), { dimensionKey: '' }));
            expect(getDimensionValues).not.toBeCalled();
            expect(result).toEqual([]);
        }));
        it('should not run if metric name not set', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield variables.execute(Object.assign(Object.assign({}, query), { metricName: '' }));
            expect(getDimensionValues).not.toBeCalled();
            expect(result).toEqual([]);
        }));
        it('should run if values are set', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield variables.execute(query);
            expect(getDimensionValues).toBeCalledWith({
                region: query.region,
                namespace: query.namespace,
                metricName: query.metricName,
                dimensionKey: query.dimensionKey,
                dimensionFilters: query.dimensionFilters,
                accountId: query.accountId,
            });
            expect(result).toEqual([{ text: 'e', value: 'e', expandable: true }]);
        }));
    });
    describe('EBS volume ids', () => {
        beforeEach(() => {
            mock.datasource.resources.getEbsVolumeIds = getEbsVolumeIds;
            getEbsVolumeIds.mockClear();
        });
        it('should not run if instance id not set', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield variables.execute(Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.EBSVolumeIDs }));
            expect(getEbsVolumeIds).not.toBeCalled();
            expect(result).toEqual([]);
        }));
        it('should run if instance id set', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield variables.execute(Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.EBSVolumeIDs, instanceID: 'foo' }));
            expect(getEbsVolumeIds).toBeCalledWith(defaultQuery.region, 'foo');
            expect(result).toEqual([{ text: 'f', value: 'f', expandable: true }]);
        }));
    });
    describe('EC2 instance attributes', () => {
        const query = Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.EC2InstanceAttributes, attributeName: 'abc', ec2Filters: { a: ['b'] } });
        beforeEach(() => {
            mock.datasource.resources.getEc2InstanceAttribute = getEc2InstanceAttribute;
            getEc2InstanceAttribute.mockClear();
        });
        it('should not run if instance id not set', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield variables.execute(Object.assign(Object.assign({}, query), { attributeName: '' }));
            expect(getEc2InstanceAttribute).not.toBeCalled();
            expect(result).toEqual([]);
        }));
        it('should run if instance id set', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield variables.execute(query);
            expect(getEc2InstanceAttribute).toBeCalledWith(query.region, query.attributeName, { a: ['b'] });
            expect(result).toEqual([{ text: 'g', value: 'g', expandable: true }]);
        }));
    });
    describe('resource arns', () => {
        const query = Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.ResourceArns, resourceType: 'abc', tags: { a: ['b'] } });
        beforeEach(() => {
            mock.datasource.resources.getResourceARNs = getResourceARNs;
            getResourceARNs.mockClear();
        });
        it('should not run if instance id not set', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield variables.execute(Object.assign(Object.assign({}, query), { resourceType: '' }));
            expect(getResourceARNs).not.toBeCalled();
            expect(result).toEqual([]);
        }));
        it('should run if instance id set', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield variables.execute(query);
            expect(getResourceARNs).toBeCalledWith(query.region, query.resourceType, { a: ['b'] });
            expect(result).toEqual([{ text: 'h', value: 'h', expandable: true }]);
        }));
    });
    it('should run statistics', () => __awaiter(void 0, void 0, void 0, function* () {
        const result = yield variables.execute(Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.Statistics }));
        expect(result).toEqual([
            { text: 'Average', value: 'Average', expandable: true },
            { text: 'Maximum', value: 'Maximum', expandable: true },
            { text: 'Minimum', value: 'Minimum', expandable: true },
            { text: 'Sum', value: 'Sum', expandable: true },
            { text: 'SampleCount', value: 'SampleCount', expandable: true },
            { text: 'IQM', value: 'IQM', expandable: true },
        ]);
    }));
    describe('log groups', () => {
        beforeEach(() => {
            mock.datasource.resources.getLogGroups = getLogGroups;
            getLogGroups.mockClear();
        });
        it('should call describe log groups', () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield variables.execute(Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.LogGroups }));
            expect(result).toEqual([
                { text: 'a', value: 'a', expandable: true },
                { text: 'b', value: 'b', expandable: true },
            ]);
        }));
        it('should replace variables', () => __awaiter(void 0, void 0, void 0, function* () {
            const query = Object.assign(Object.assign({}, defaultQuery), { queryType: VariableQueryType.LogGroups, logGroupPrefix: '$fields', accountId: '123' });
            yield variables.execute(query);
            expect(getLogGroups).toBeCalledWith({
                region: query.region,
                logGroupNamePrefix: 'templatedField',
                listAllLogGroups: true,
                accountId: query.accountId,
            });
        }));
    });
});
//# sourceMappingURL=variables.test.js.map