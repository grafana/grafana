const RESOURCE_URI_REGEX = /\/subscriptions\/(?<subscriptionID>.+)\/resourceGroups\/(?<resourceGroup>.+)\/providers.+\/(?<resource>[\w-_]+)/;

export function parseResourceURI(resourceURI: string) {
  const matches = RESOURCE_URI_REGEX.exec(resourceURI);

  if (!matches?.groups?.subscriptionID || !matches?.groups?.resourceGroup) {
    return undefined;
  }

  const { subscriptionID, resourceGroup, resource } = matches.groups;
  return { subscriptionID, resourceGroup, resource };
}
