import { Row, RowGroup } from './types';

const RESOURCE_URI_REGEX = /\/subscriptions\/(?<subscriptionID>.+)\/resourceGroups\/(?<resourceGroup>.+)\/providers\/(?<cloud>.+)/;

export function parseResourceURI(resourceURI: string) {
  const matches = RESOURCE_URI_REGEX.exec(resourceURI);

  if (!matches?.groups?.subscriptionID || !matches?.groups?.resourceGroup) {
    return undefined;
  }

  const { subscriptionID, resourceGroup } = matches.groups;
  return { subscriptionID, resourceGroup };
}

export function findNestedResource(rows: RowGroup, resourceURI: string): Row | undefined {
  for (const key in rows) {
    const row = rows[key];
    if (row.id === resourceURI) {
      return row;
    }
    if (row.children) {
      return findNestedResource(row.children, resourceURI);
    }
  }

  return undefined;
}
