import { Databases } from 'app/percona/shared/core';
import { SERVICE_MAP, THOUSAND } from './DBCluster.constants';
import { DBClusterStatus, ResourcesUnits, } from './DBCluster.types';
export const isClusterChanging = ({ status }) => {
    return status === DBClusterStatus.changing || status === DBClusterStatus.deleting;
};
export const newDBClusterService = (type) => {
    const service = SERVICE_MAP[type];
    return service || SERVICE_MAP[Databases.mysql];
};
export const isOptionEmpty = (option) => !option || Object.keys(option).length === 0 || !option.value;
export const formatResources = (bytes, decimals) => {
    const i = Math.floor(Math.log(bytes) / Math.log(THOUSAND));
    const units = Object.values(ResourcesUnits)[i];
    return { value: parseFloat((bytes / Math.pow(THOUSAND, i)).toFixed(decimals)), units, original: bytes };
};
export const getResourcesDifference = ({ value: valueA, original: originalA, units: unitsA }, { value: valueB, original: originalB, units: unitsB }) => {
    if (unitsA !== unitsB) {
        return null;
    }
    return {
        original: originalA - originalB,
        value: valueA - valueB,
        units: unitsA,
    };
};
export const getResourcesSum = ({ value: valueA, original: originalA, units: unitsA }, { value: valueB, original: originalB, units: unitsB }) => {
    if (unitsA !== unitsB) {
        return null;
    }
    return {
        original: originalA + originalB,
        value: valueA + valueB,
        units: unitsA,
    };
};
export const getExpectedResourcesDifference = ({ expected: { cpu: cpuA, memory: memoryA, disk: diskA } }, { expected: { cpu: cpuB, memory: memoryB, disk: diskB } }) => {
    return {
        expected: {
            cpu: getResourcesDifference(cpuA, cpuB),
            memory: getResourcesDifference(memoryA, memoryB),
            disk: getResourcesDifference(diskA, diskB),
        },
    };
};
export const formatDBClusterVersion = (version) => (version ? version.split(':')[1].split('-')[0] : '');
export const formatDBClusterVersionWithBuild = (version) => (version ? version.split(':')[1] : '');
//# sourceMappingURL=DBCluster.utils.js.map