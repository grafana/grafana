import { HttpResponse, http } from 'msw';

import { Description, ResourcePermission } from 'app/core/components/AccessControl/types';
import { AccessControlAction } from 'app/types/accessControl';

// TODO: Expand this out to more realistic use cases as we work on RBAC for contact points
const resourceDescriptionsMap: Record<string, Description> = {
  receivers: {
    assignments: {
      users: true,
      serviceAccounts: true,
      teams: true,
      builtInRoles: true,
    },
    permissions: ['View', 'Edit', 'Admin'],
  },
};

/**
 * Map of pre-determined resources and corresponding IDs for those resources,
 * to permissions for those resources
 * */
const resourceDetailsMap: Record<string, Record<string, ResourcePermission[]>> = {
  receivers: {
    'lotsa-emails': [
      {
        id: 123,
        roleName: 'somerole:name',
        isManaged: true,
        isInherited: false,
        isServiceAccount: false,
        builtInRole: 'Viewer',
        actions: [AccessControlAction.FoldersRead, AccessControlAction.AlertingRuleRead],
        permission: 'View',
      },
    ],
  },
};

const getAccessControlResourceDescriptionHandler = () =>
  http.get<{ resourceType: string }>(`/api/access-control/:resourceType/description`, ({ params }) => {
    const matchedResourceDescription = resourceDescriptionsMap[params.resourceType];
    return matchedResourceDescription
      ? HttpResponse.json(matchedResourceDescription)
      : HttpResponse.json({ message: 'Not found' }, { status: 404 });
  });

const getAccessControlResourceDetailsHandler = () =>
  http.get<{ resourceType: string; resourceId: string }>(
    `/api/access-control/:resourceType/:resourceId`,
    ({ params }) => {
      const matchedResourceDetails = resourceDetailsMap[params.resourceType][params.resourceId];
      return matchedResourceDetails
        ? HttpResponse.json(matchedResourceDetails)
        : HttpResponse.json(
            {
              message: 'Failed to get permissions',
              traceID: '',
            },
            { status: 404 }
          );
    }
  );

const handlers = [getAccessControlResourceDescriptionHandler(), getAccessControlResourceDetailsHandler()];

export default handlers;
