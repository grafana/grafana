import { compareArrayValues, compareDataFrameStructures, PanelData } from '@grafana/data';

export const setStructureRevision = (result: PanelData, lastResult: PanelData | undefined) => {
  let structureRev = 1;

  if (lastResult?.structureRev && lastResult.series) {
    structureRev = lastResult.structureRev;
    const sameStructure = compareArrayValues(result.series, lastResult.series, compareDataFrameStructures);
    if (!sameStructure) {
      structureRev++;
    }
  }

  result.structureRev = structureRev;
  return result;
};
