import { __awaiter } from "tslib";
import { logger } from 'app/percona/shared/helpers/logger';
import { DATABASE_LABELS } from '../../../../shared/core';
import { getActiveOperators, getDatabaseOptionFromOperator } from '../../Kubernetes/Kubernetes.utils';
import { newDBClusterService } from '../DBCluster.utils';
import { DEFAULT_SIZES, INITIAL_VALUES, MIN_NODES, } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.constants';
import { DBClusterResources } from './DBClusterAdvancedOptions/DBClusterAdvancedOptions.types';
import { BasicOptionsFields } from './DBClusterBasicOptions/DBClusterBasicOptions.types';
import { getKubernetesOptions } from './DBClusterBasicOptions/DBClusterBasicOptions.utils';
export const getAddInitialValues = (kubernetes, preSelectedCluster) => {
    const activeOperators = getActiveOperators(preSelectedCluster ? [preSelectedCluster] : kubernetes);
    const initialValues = Object.assign(Object.assign({}, INITIAL_VALUES), { [BasicOptionsFields.databaseType]: activeOperators.length === 1
            ? getDatabaseOptionFromOperator(activeOperators[0])
            : { value: undefined, label: undefined } });
    if (kubernetes.length > 0) {
        const kubernetesOptions = getKubernetesOptions(preSelectedCluster ? [preSelectedCluster] : kubernetes);
        const initialCluster = kubernetesOptions.length > 0 && kubernetesOptions[0];
        if (initialCluster) {
            initialValues[BasicOptionsFields.kubernetesCluster] = initialCluster;
            if (activeOperators.length > 0) {
                const databaseDefaultOperator = getDatabaseOptionFromOperator(activeOperators[0]);
                initialValues[BasicOptionsFields.databaseType] = databaseDefaultOperator;
                initialValues[BasicOptionsFields.name] = `${databaseDefaultOperator === null || databaseDefaultOperator === void 0 ? void 0 : databaseDefaultOperator.value}-${generateUID()}`;
            }
        }
    }
    return initialValues;
};
export const generateUID = () => {
    const firstPart = ('000' + ((Math.random() * 46656) | 0).toString(36)).slice(-3);
    const secondPart = ('000' + ((Math.random() * 46656) | 0).toString(36)).slice(-3);
    return firstPart + secondPart;
};
export const getDBClusterConfiguration = (selectedCluster) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const dbClusterService = newDBClusterService(selectedCluster.databaseType);
        const result = yield dbClusterService.getClusterConfiguration(selectedCluster);
        return result;
    }
    catch (e) {
        logger.error(e);
    }
    return;
});
export const getEditInitialValues = (selectedDBCluster, configuration) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { template, clusterSize, sourceRanges, databaseType, cpu, disk, memory } = selectedDBCluster;
    const isCluster = clusterSize > 1;
    const sourceRangesArray = (sourceRanges === null || sourceRanges === void 0 ? void 0 : sourceRanges.map((item) => ({ sourceRange: item }))) || [{ sourceRange: '' }];
    const storageClass = ((_b = (_a = configuration === null || configuration === void 0 ? void 0 : configuration.params) === null || _a === void 0 ? void 0 : _a.replicaset) === null || _b === void 0 ? void 0 : _b.storage_class) || ((_d = (_c = configuration === null || configuration === void 0 ? void 0 : configuration.params) === null || _c === void 0 ? void 0 : _c.pxc) === null || _d === void 0 ? void 0 : _d.storage_class);
    const clusterParameters = Object.assign(Object.assign({ nodes: isCluster ? clusterSize : MIN_NODES, databaseType: {
            value: databaseType,
            label: DATABASE_LABELS[databaseType],
        }, cpu,
        disk,
        memory, configuration: ((_f = (_e = configuration === null || configuration === void 0 ? void 0 : configuration.params) === null || _e === void 0 ? void 0 : _e.pxc) === null || _f === void 0 ? void 0 : _f.configuration) || ((_h = (_g = configuration === null || configuration === void 0 ? void 0 : configuration.params) === null || _g === void 0 ? void 0 : _g.replicaset) === null || _h === void 0 ? void 0 : _h.configuration), expose: configuration === null || configuration === void 0 ? void 0 : configuration.exposed, internetFacing: configuration === null || configuration === void 0 ? void 0 : configuration.internet_facing, sourceRanges: sourceRangesArray }, (storageClass && { storageClass: { label: storageClass, value: storageClass } })), (template && { template: { label: template.name, value: template.kind } }));
    const isMatchSize = (type) => DEFAULT_SIZES[type].cpu === cpu && DEFAULT_SIZES[type].memory === memory && DEFAULT_SIZES[type].disk === disk;
    if (isMatchSize(DBClusterResources.small)) {
        clusterParameters.resources = DBClusterResources.small;
    }
    else if (isMatchSize(DBClusterResources.medium)) {
        clusterParameters.resources = DBClusterResources.medium;
    }
    else if (isMatchSize(DBClusterResources.large)) {
        clusterParameters.resources = DBClusterResources.large;
    }
    else {
        clusterParameters.resources = DBClusterResources.custom;
    }
    return clusterParameters;
};
//# sourceMappingURL=EditDBClusterPage.utils.js.map