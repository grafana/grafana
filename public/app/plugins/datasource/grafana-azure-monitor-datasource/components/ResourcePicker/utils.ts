import produce from 'immer';
import { ResourceRow, ResourceRowGroup } from './types';

export function isGUIDish(input: string) {
  return !!input.match(/^[A-Z0-9]+/i);
}

export function findRow(rows: ResourceRowGroup, id: string): ResourceRow | undefined {
  for (const row of rows) {
    if (row.id.toLowerCase() === id.toLowerCase()) {
      return row;
    }

    if (row.children) {
      const result = findRow(row.children, id);

      if (result) {
        return result;
      }
    }
  }

  return undefined;
}

export function addResources(rows: ResourceRowGroup, targetResourceGroupID: string, newResources: ResourceRowGroup) {
  return produce(rows, (draftState) => {
    const draftRow = findRow(draftState, targetResourceGroupID);

    if (!draftRow) {
      // This case shouldn't happen often because we're usually coming here from a resource we already have
      throw new Error('Unable to find resource');
    }

    draftRow.children = newResources;
  });
}
