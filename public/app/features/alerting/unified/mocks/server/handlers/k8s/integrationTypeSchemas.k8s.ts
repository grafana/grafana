import { HttpResponse, http } from 'msw';

import { grafanaAlertNotifiersMock } from 'app/features/alerting/unified/mockGrafanaNotifiers';
import { NotifierDTO } from 'app/features/alerting/unified/types/alerting';

import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from '../../utils';

function transformToK8sSchema(notifier: NotifierDTO) {
  return {
    metadata: {
      name: notifier.type,
      namespace: 'default',
    },
    spec: {
      type: notifier.type,
      name: notifier.name,
      heading: notifier.heading,
      description: notifier.description,
      info: notifier.info,
      currentVersion: notifier.currentVersion ?? 'v1',
      deprecated: notifier.deprecated,
      versions: notifier.versions ?? [
        {
          version: 'v1',
          canCreate: true,
          options: notifier.options ?? [],
        },
      ],
    },
  };
}

export const getIntegrationTypeSchemasHandler = () =>
  http.get<{ namespace: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/integrationtypeschemas`,
    () => {
      const items = grafanaAlertNotifiersMock.map(transformToK8sSchema);
      return HttpResponse.json(getK8sResponse('IntegrationTypeSchemaList', items));
    }
  );

const handlers = [getIntegrationTypeSchemasHandler()];
export default handlers;
