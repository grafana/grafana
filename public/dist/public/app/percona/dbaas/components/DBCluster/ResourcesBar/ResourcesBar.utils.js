import { ResourcesUnits } from '../DBCluster.types';
import { getResourcesSum } from '../DBCluster.utils';
export const getResourcesWidth = (allocated, total) => {
    if (!allocated || !total || total <= 0) {
        return 0;
    }
    return Math.round(((allocated * 100) / total) * 10) / 10;
};
export const formatResources = (resource) => (Object.assign(Object.assign({}, resource), { value: Math.round(resource.value * 100 + Number.EPSILON) / 100 }));
export const getExpectedAllocatedWidth = (expected, allocated) => {
    if (!expected || !allocated || Math.abs(expected.original) > allocated.original) {
        return 0;
    }
    return 100 - Math.abs(getResourcesWidth(expected.original, allocated.original));
};
export const getExpectedAllocated = (expected, allocated) => {
    if (!expected || !allocated || Math.abs(expected.original) > allocated.original) {
        return { value: 0, original: 0, units: (expected === null || expected === void 0 ? void 0 : expected.units) || ResourcesUnits.BYTES };
    }
    return getResourcesSum(expected, allocated);
};
//# sourceMappingURL=ResourcesBar.utils.js.map