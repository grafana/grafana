import produce from 'immer';

import { getTemplateSrv } from '@grafana/runtime';

import UrlBuilder from '../../azure_monitor/url_builder';
import { ResourcePickerQueryType } from '../../resourcePicker/resourcePickerData';
import { AzureMonitorResource, AzureMonitorQuery } from '../../types';

import { ResourceRow, ResourceRowGroup } from './types';

// This regex matches URIs representing:
//  - subscriptions: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572
//  - resource groups: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources
//  - resources: /subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Compute/virtualMachines/GithubTestDataVM
const RESOURCE_URI_REGEX =
  /\/subscriptions\/(?<subscription>[^/]+)(?:\/resourceGroups\/(?<resourceGroup>[^/]+)(?:\/providers\/(?<metricNamespaceAndResource>.+))?)?/;

type RegexGroups = Record<string, string | undefined>;

function parseNamespaceAndName(metricNamespaceAndName?: string) {
  if (!metricNamespaceAndName) {
    return {};
  }
  const stringArray = metricNamespaceAndName.split('/');
  // The first two groups belong to the namespace (e.g. Microsoft.Storage/storageAccounts)
  const namespaceArray = stringArray.splice(0, 2);
  // The next element belong to the resource name (e.g. storageAcc1)
  const resourceNameArray = stringArray.splice(0, 1);
  // If there are more elements, keep adding them to the namespace and resource name, alternatively
  // e.g (blobServices/default)
  while (stringArray.length) {
    const nextElem = stringArray.shift()!;
    stringArray.length % 2 === 0 ? resourceNameArray.push(nextElem) : namespaceArray.push(nextElem);
  }
  return { metricNamespace: namespaceArray.join('/'), resourceName: resourceNameArray.join('/') };
}

export function parseResourceURI(resourceURI: string): AzureMonitorResource {
  const matches = RESOURCE_URI_REGEX.exec(resourceURI);
  const groups: RegexGroups = matches?.groups ?? {};
  const { subscription, resourceGroup, metricNamespaceAndResource } = groups;
  const { metricNamespace, resourceName } = parseNamespaceAndName(metricNamespaceAndResource);

  return { subscription, resourceGroup, metricNamespace, resourceName };
}

export function parseMultipleResourceDetails(resources: Array<string | AzureMonitorResource>, location?: string) {
  return resources.map((resource) => {
    return parseResourceDetails(resource, location);
  });
}

export function parseResourceDetails(resource: string | AzureMonitorResource, location?: string) {
  if (typeof resource === 'string') {
    const res = parseResourceURI(resource);
    if (location) {
      res.region = location;
    }
    return res;
  }
  return resource;
}

export function resourcesToStrings(resources: Array<string | AzureMonitorResource>) {
  return resources.map((resource) => resourceToString(resource));
}

export function resourceToString(resource?: string | AzureMonitorResource) {
  return resource
    ? typeof resource === 'string'
      ? resource
      : UrlBuilder.buildResourceUri(getTemplateSrv(), resource)
    : '';
}

export function isGUIDish(input: string) {
  return !!input.match(/^[A-Z0-9]+/i);
}

function compareNamespaceAndName(
  rowNamespace?: string,
  rowName?: string,
  resourceNamespace?: string,
  resourceName?: string
) {
  // StorageAccounts subresources are not listed independently
  if (resourceNamespace?.startsWith('microsoft.storage/storageaccounts')) {
    resourceNamespace = 'microsoft.storage/storageaccounts';
    if (resourceName?.endsWith('/default')) {
      resourceName = resourceName.slice(0, -'/default'.length);
    }
  }
  return rowNamespace === resourceNamespace && rowName === resourceName;
}

export function matchURI(rowURI: string, resourceURI: string) {
  const targetParams = parseResourceDetails(resourceURI);
  const rowParams = parseResourceDetails(rowURI);

  return (
    rowParams?.subscription === targetParams?.subscription &&
    rowParams?.resourceGroup?.toLowerCase() === targetParams?.resourceGroup?.toLowerCase() &&
    compareNamespaceAndName(
      rowParams?.metricNamespace?.toLowerCase(),
      rowParams?.resourceName,
      targetParams?.metricNamespace?.toLowerCase(),
      targetParams?.resourceName
    )
  );
}

export function findRows(rows: ResourceRowGroup, uris: string[]): ResourceRow[] {
  const result: ResourceRow[] = [];
  uris.forEach((uri) => {
    const row = findRow(rows, uri);
    if (row) {
      result.push(row);
    }
  });
  return result;
}

export function findRow(rows: ResourceRowGroup, uri: string): ResourceRow | undefined {
  for (const row of rows) {
    if (matchURI(row.uri, uri)) {
      return row;
    }

    if (row.children) {
      const result = findRow(row.children, uri);

      if (result) {
        return result;
      }
    }
  }

  return undefined;
}

export function addResources(rows: ResourceRowGroup, targetParentId: string, newResources: ResourceRowGroup) {
  return produce(rows, (draftState) => {
    const draftRow = findRow(draftState, targetParentId);

    // we can't find the selected resource in our list of resources,
    // probably means user has either mistyped in the input field
    // or is using template variables.
    // either way no need to throw, just show that none of the resources are checked
    if (!draftRow) {
      return;
    }

    draftRow.children = newResources;
  });
}

export function setResources(
  query: AzureMonitorQuery,
  type: ResourcePickerQueryType,
  resources: Array<string | AzureMonitorResource>
): AzureMonitorQuery {
  if (type === 'logs') {
    // Resource URI for LogAnalytics
    return {
      ...query,
      azureLogAnalytics: {
        ...query.azureLogAnalytics,
        resources: resourcesToStrings(resources).filter((resource) => resource !== ''),
      },
    };
  }
  // Resource object for metrics
  const parsedResource = resources.length ? parseResourceDetails(resources[0]) : {};
  return {
    ...query,
    subscription: parsedResource.subscription,
    azureMonitor: {
      ...query.azureMonitor,
      metricNamespace: parsedResource.metricNamespace?.toLocaleLowerCase(),
      region: parsedResource.region,
      resources: parseMultipleResourceDetails(resources).filter(
        (resource) =>
          resource.resourceName !== '' &&
          resource.metricNamespace !== '' &&
          resource.subscription !== '' &&
          resource.resourceGroup !== ''
      ),
      metricName: undefined,
      aggregation: undefined,
      timeGrain: '',
      dimensionFilters: [],
    },
  };
}
