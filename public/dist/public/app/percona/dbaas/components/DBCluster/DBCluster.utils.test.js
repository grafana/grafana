import { DBClusterStatus, ResourcesUnits } from './DBCluster.types';
import { isClusterChanging, formatResources, isOptionEmpty, getResourcesDifference, getExpectedResourcesDifference, getResourcesSum, formatDBClusterVersion, formatDBClusterVersionWithBuild, } from './DBCluster.utils';
import { dbClustersStub, resourcesA, resourcesB, resourcesC } from './__mocks__/dbClustersStubs';
describe('DBCluster.utils::', () => {
    it('returns true if cluster is changing', () => {
        const result = isClusterChanging(Object.assign(Object.assign({}, dbClustersStub[0]), { status: DBClusterStatus.changing }));
        expect(result).toBeTruthy();
    });
    it('returns true if cluster is deleting', () => {
        const result = isClusterChanging(Object.assign(Object.assign({}, dbClustersStub[0]), { status: DBClusterStatus.deleting }));
        expect(result).toBeTruthy();
    });
    it('returns false if cluster is ready', () => {
        const result = isClusterChanging(Object.assign(Object.assign({}, dbClustersStub[0]), { status: DBClusterStatus.ready }));
        expect(result).toBeFalsy();
    });
    it('returns false if cluster is invalid', () => {
        const result = isClusterChanging(Object.assign(Object.assign({}, dbClustersStub[0]), { status: DBClusterStatus.invalid }));
        expect(result).toBeFalsy();
    });
    it('returns false if cluster has no status', () => {
        const result = isClusterChanging(Object.assign({}, dbClustersStub[0]));
        expect(result).toBeFalsy();
    });
    it('formats resources correctly', () => {
        expect(formatResources(1000, 2)).toEqual({ value: 1, units: ResourcesUnits.KB, original: 1000 });
        expect(formatResources(1010, 2)).toEqual({ value: 1.01, units: ResourcesUnits.KB, original: 1010 });
        expect(formatResources(1010, 1)).toEqual({ value: 1, units: ResourcesUnits.KB, original: 1010 });
        expect(formatResources(1010, 1)).toEqual({ value: 1, units: ResourcesUnits.KB, original: 1010 });
        expect(formatResources(1015, 3)).toEqual({ value: 1.015, units: ResourcesUnits.KB, original: 1015 });
        expect(formatResources(2597, 3)).toEqual({ value: 2.597, units: ResourcesUnits.KB, original: 2597 });
        expect(formatResources(1500000000, 2)).toEqual({ value: 1.5, units: ResourcesUnits.GB, original: 1500000000 });
        expect(formatResources(1570000000, 3)).toEqual({ value: 1.57, units: ResourcesUnits.GB, original: 1570000000 });
        expect(formatResources(6200000000000, 2)).toEqual({
            value: 6.2,
            units: ResourcesUnits.TB,
            original: 6200000000000,
        });
        expect(formatResources(6244440000000, 5)).toEqual({
            value: 6.24444,
            units: ResourcesUnits.TB,
            original: 6244440000000,
        });
    });
    it('indentifies empty option correctly', () => {
        expect(isOptionEmpty(undefined)).toBeTruthy();
        expect(isOptionEmpty({})).toBeTruthy();
        expect(isOptionEmpty({ label: 'test label' })).toBeTruthy();
        expect(isOptionEmpty({ value: 'test value' })).toBeFalsy();
    });
    it('calculates resources difference correctly', () => {
        const expectedResourcesA = {
            expected: {
                cpu: resourcesA,
                memory: resourcesA,
                disk: resourcesA,
            },
        };
        const expectedResourcesB = {
            expected: {
                cpu: resourcesB,
                memory: resourcesB,
                disk: resourcesB,
            },
        };
        const resultA = {
            value: 0,
            original: 0,
            units: ResourcesUnits.BYTES,
        };
        const resultB = {
            value: -10,
            original: -10,
            units: ResourcesUnits.BYTES,
        };
        const resultC = {
            value: 10,
            original: 10,
            units: ResourcesUnits.BYTES,
        };
        expect(getResourcesDifference(resourcesA, resourcesA)).toEqual(resultA);
        expect(getResourcesDifference(resourcesA, resourcesB)).toEqual(resultB);
        expect(getResourcesDifference(resourcesB, resourcesA)).toEqual(resultC);
        expect(getResourcesDifference(resourcesB, resourcesC)).toBeNull();
        expect(getExpectedResourcesDifference(expectedResourcesA, expectedResourcesA)).toEqual({
            expected: {
                cpu: resultA,
                memory: resultA,
                disk: resultA,
            },
        });
        expect(getExpectedResourcesDifference(expectedResourcesA, expectedResourcesB)).toEqual({
            expected: {
                cpu: resultB,
                memory: resultB,
                disk: resultB,
            },
        });
        expect(getExpectedResourcesDifference(expectedResourcesB, expectedResourcesA)).toEqual({
            expected: {
                cpu: resultC,
                memory: resultC,
                disk: resultC,
            },
        });
    });
    it('calculates resources sum correctly', () => {
        const resultA = {
            value: 20,
            original: 20,
            units: ResourcesUnits.BYTES,
        };
        const resultB = {
            value: 30,
            original: 30,
            units: ResourcesUnits.BYTES,
        };
        expect(getResourcesSum(resourcesA, resourcesA)).toEqual(resultA);
        expect(getResourcesSum(resourcesA, resourcesB)).toEqual(resultB);
        expect(getResourcesSum(resourcesB, resourcesA)).toEqual(resultB);
        expect(getResourcesSum(resourcesB, resourcesC)).toBeNull();
    });
    it('formats version correctly', () => {
        expect(formatDBClusterVersion('percona/percona-xtradb-cluster:8.0.22-13.1')).toBe('8.0.22');
        expect(formatDBClusterVersion('percona/percona-xtradb-cluster:5.6.2')).toBe('5.6.2');
        expect(formatDBClusterVersion(undefined)).toBe('');
    });
    it('formats version correctly with build number', () => {
        expect(formatDBClusterVersionWithBuild('percona/percona-xtradb-cluster:8.0.22-13.1')).toBe('8.0.22-13.1');
        expect(formatDBClusterVersionWithBuild('percona/percona-xtradb-cluster:5.6.2')).toBe('5.6.2');
        expect(formatDBClusterVersionWithBuild(undefined)).toBe('');
    });
});
//# sourceMappingURL=DBCluster.utils.test.js.map