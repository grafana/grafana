import { ResourcesUnits } from '../DBCluster.types';
import { resourcesA, resourcesB } from '../__mocks__/dbClustersStubs';
import { formatResources, getExpectedAllocated, getExpectedAllocatedWidth, getResourcesWidth, } from './ResourcesBar.utils';
describe('ResourcesBar.utils::', () => {
    it('returns correct width', () => {
        expect(getResourcesWidth(1.5, 6)).toEqual(25);
        expect(getResourcesWidth(1.6, 6)).toEqual(26.7);
        expect(getResourcesWidth(5.6, 64)).toEqual(8.8);
        expect(getResourcesWidth(63.8, 64)).toEqual(99.7);
        expect(getResourcesWidth(10, 80)).toEqual(12.5);
        expect(getResourcesWidth(20, 80)).toEqual(25);
    });
    it('formats resources to 2 decimal places if needed', () => {
        const getValueWithUnits = (value) => ({ value, units: ResourcesUnits.GB });
        expect(formatResources(getValueWithUnits(0.04))).toEqual(getValueWithUnits(0.04));
        expect(formatResources(getValueWithUnits(0.004))).toEqual(getValueWithUnits(0));
        expect(formatResources(getValueWithUnits(0.07340032))).toEqual(getValueWithUnits(0.07));
        expect(formatResources(getValueWithUnits(0.076))).toEqual(getValueWithUnits(0.08));
        expect(formatResources(getValueWithUnits(4.129873))).toEqual(getValueWithUnits(4.13));
        expect(formatResources(getValueWithUnits(0.65))).toEqual(getValueWithUnits(0.65));
        expect(formatResources(getValueWithUnits(6))).toEqual(getValueWithUnits(6));
    });
    it('returns correct expected allocated width', () => {
        expect(getExpectedAllocatedWidth(undefined, undefined)).toBe(0);
        expect(getExpectedAllocatedWidth(resourcesB, resourcesA)).toBe(0);
        expect(getExpectedAllocatedWidth(Object.assign(Object.assign({}, resourcesA), { original: -40 }), resourcesB)).toBe(0);
        expect(getExpectedAllocatedWidth(resourcesA, resourcesB)).toBe(50);
        expect(getExpectedAllocatedWidth(Object.assign(Object.assign({}, resourcesA), { original: -5 }), resourcesB)).toBe(75);
        expect(getExpectedAllocatedWidth(Object.assign(Object.assign({}, resourcesA), { original: -1 }), Object.assign(Object.assign({}, resourcesA), { original: 4 }))).toBe(75);
    });
    it('returns correct expected allocated value', () => {
        expect(getExpectedAllocated(undefined, undefined)).toEqual({
            value: 0,
            original: 0,
            units: ResourcesUnits.BYTES,
        });
        expect(getExpectedAllocated(resourcesA, resourcesA)).toEqual({
            value: 20,
            original: 20,
            units: ResourcesUnits.BYTES,
        });
        expect(getExpectedAllocated(resourcesA, resourcesB)).toEqual({
            value: 30,
            original: 30,
            units: ResourcesUnits.BYTES,
        });
    });
});
//# sourceMappingURL=ResourcesBar.utils.test.js.map