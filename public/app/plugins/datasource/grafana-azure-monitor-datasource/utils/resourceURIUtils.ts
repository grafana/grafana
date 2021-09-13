// This regex matches URIs representing:
//  - subscriptions: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572
//  - resource groups: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources
//  - resources: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Compute/virtualMachines/GithubTestDataVM
const RESOURCE_URI_REGEX = /\/subscriptions\/(?<subscriptionID>[^/]+)(?:\/resourceGroups\/(?<resourceGroup>[^/]+)(?:\/providers.+\/(?<resource>[^/]+))?)?/;

type RegexGroups = Record<string, string | undefined>;

export function parseResourceURI(resourceURI: string) {
  const matches = RESOURCE_URI_REGEX.exec(resourceURI);
  const groups: RegexGroups = matches?.groups ?? {};
  const { subscriptionID, resourceGroup, resource } = groups;

  if (!subscriptionID) {
    return undefined;
  }

  return { subscriptionID, resourceGroup, resource };
}

// TODO: test this with NetApp and Database resources!!! Their resourceURI format might not be so simple
export function createResourceURI({
  subscriptionID,
  resourceGroup,
  resourceType, // sometimes called "metricDefinition" elsewhere
  resource,
}: {
  subscriptionID: string;
  resourceGroup?: string;
  resourceType?: string;
  resource?: string;
}) {
  var uriParts = ['/subscriptions', subscriptionID];

  if (resourceGroup) {
    uriParts.push('resourceGroups', resourceGroup);
  }

  if (resourceGroup && resourceType) {
    uriParts.push('providers', resourceType);
  }

  if (resourceGroup && resourceType && resource) {
    uriParts.push(resource);
  }

  return uriParts.join('/');
}
