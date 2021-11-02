import { compareArrayValues, compareDataFrameStructures } from '@grafana/data';
export var setStructureRevision = function (result, lastResult) {
    var structureRev = 1;
    if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.structureRev) && lastResult.series) {
        structureRev = lastResult.structureRev;
        var sameStructure = compareArrayValues(result.series, lastResult.series, compareDataFrameStructures);
        if (!sameStructure) {
            structureRev++;
        }
    }
    result.structureRev = structureRev;
    return result;
};
//# sourceMappingURL=revision.js.map