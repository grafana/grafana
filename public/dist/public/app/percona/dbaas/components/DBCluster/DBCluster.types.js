import { Databases } from 'app/percona/shared/core';
export var DBClusterType;
(function (DBClusterType) {
    DBClusterType["pxc"] = "DB_CLUSTER_TYPE_PXC";
    DBClusterType["psmdb"] = "DB_CLUSTER_TYPE_PSMDB";
})(DBClusterType || (DBClusterType = {}));
export const DatabaseToDBClusterTypeMapping = {
    [Databases.mysql]: DBClusterType.pxc,
    [Databases.mongodb]: DBClusterType.psmdb,
};
export var DBClusterStatus;
(function (DBClusterStatus) {
    DBClusterStatus["invalid"] = "DB_CLUSTER_STATE_INVALID";
    DBClusterStatus["changing"] = "DB_CLUSTER_STATE_CHANGING";
    DBClusterStatus["ready"] = "DB_CLUSTER_STATE_READY";
    DBClusterStatus["failed"] = "DB_CLUSTER_STATE_FAILED";
    DBClusterStatus["deleting"] = "DB_CLUSTER_STATE_DELETING";
    DBClusterStatus["suspended"] = "DB_CLUSTER_STATE_PAUSED";
    DBClusterStatus["upgrading"] = "DB_CLUSTER_STATE_UPGRADING";
    DBClusterStatus["unknown"] = "DB_CLUSTER_STATE_UNKNOWN";
})(DBClusterStatus || (DBClusterStatus = {}));
export const DBClusterStatusColors = {
    [DBClusterStatus.invalid]: 'red',
    [DBClusterStatus.changing]: 'blue',
    [DBClusterStatus.ready]: 'green',
    [DBClusterStatus.failed]: 'red',
    [DBClusterStatus.deleting]: 'blue',
    [DBClusterStatus.suspended]: 'orange',
    [DBClusterStatus.upgrading]: 'blue',
    [DBClusterStatus.unknown]: 'red',
};
export var ResourcesUnits;
(function (ResourcesUnits) {
    ResourcesUnits["BYTES"] = "Bytes";
    ResourcesUnits["KB"] = "KB";
    ResourcesUnits["MB"] = "MB";
    ResourcesUnits["GB"] = "GB";
    ResourcesUnits["TB"] = "TB";
    ResourcesUnits["PB"] = "PB";
    ResourcesUnits["EB"] = "EB";
})(ResourcesUnits || (ResourcesUnits = {}));
export var CpuUnits;
(function (CpuUnits) {
    CpuUnits["MILLI"] = "CPU";
})(CpuUnits || (CpuUnits = {}));
export var DBClusterComponentVersionStatus;
(function (DBClusterComponentVersionStatus) {
    DBClusterComponentVersionStatus["available"] = "available";
    DBClusterComponentVersionStatus["recommended"] = "recommended";
})(DBClusterComponentVersionStatus || (DBClusterComponentVersionStatus = {}));
//# sourceMappingURL=DBCluster.types.js.map