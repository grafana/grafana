import { compareArrayValues, compareDataFrameStructures } from '@grafana/data';
export const setStructureRevision = (result, lastResult) => {
    let structureRev = 1;
    if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.structureRev) && lastResult.series) {
        structureRev = lastResult.structureRev;
        const sameStructure = compareArrayValues(result.series, lastResult.series, compareDataFrameStructures);
        if (!sameStructure) {
            structureRev++;
        }
    }
    result.structureRev = structureRev;
    return result;
};
//# sourceMappingURL=revision.js.map