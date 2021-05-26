import produce from 'immer';
import { ResourceRow, ResourceRowGroup } from './types';

const RESOURCE_URI_REGEX = /\/subscriptions\/(?<subscriptionID>.+)\/resourceGroups\/(?<resourceGroup>.+)\/providers.+\/(?<resource>[\w-_]+)/;

export function parseResourceURI(resourceURI: string) {
  const matches = RESOURCE_URI_REGEX.exec(resourceURI);

  if (!matches?.groups?.subscriptionID || !matches?.groups?.resourceGroup) {
    return undefined;
  }

  const { subscriptionID, resourceGroup, resource } = matches.groups;
  return { subscriptionID, resourceGroup, resource };
}

export function isGUIDish(input: string) {
  return !!input.match(/^[A-Z0-9]+/i);
}

export function findRow(rows: ResourceRowGroup, id: string): ResourceRow | undefined {
  for (const row of rows) {
    if (row.id === id) {
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
