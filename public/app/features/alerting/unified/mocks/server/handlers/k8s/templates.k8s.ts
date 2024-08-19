import { HttpResponse, http } from 'msw';

import alertmanagerConfig from 'app/features/alerting/unified/components/contact-points/__mocks__/alertmanager.config.mock.json';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';
import { ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup } from 'app/features/alerting/unified/openapi/templatesApi.gen';
import { PROVENANCE_ANNOTATION, PROVENANCE_NONE } from 'app/features/alerting/unified/utils/k8s/constants';
import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

const config: AlertManagerCortexConfig = alertmanagerConfig;

// Map alertmanager templates to k8s templates
const mappedTemplates = Object.entries(
  config.template_files || {}
).map<ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup>(([name, template]) => ({
  metadata: {
    name: nameToUid(name), // K8s uses unique identifiers for resources
    annotations: { [PROVENANCE_ANNOTATION]: config.template_file_provenances?.[name] || PROVENANCE_NONE },
  },
  spec: {
    title: name,
    content: template,
  },
}));

const parsedTemplates = getK8sResponse<ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup>(
  'TemplateGroupList',
  mappedTemplates
);

const listNamespacedTemplateHandler = () =>
  http.get<{ namespace: string }>(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/templategroups`, () => {
    return HttpResponse.json(parsedTemplates);
  });

const getNamespacedTemplateHandler = () =>
  http.get<{ namespace: string; name: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/templategroups/:name`,
    ({ params }) => {
      const { name } = params;
      const template = parsedTemplates.items.find((t) => t.metadata.name === name);

      if (!template) {
        return HttpResponse.json({ message: 'NotFound' }, { status: 404 });
      }

      return HttpResponse.json(template);
    }
  );

const handlers = [listNamespacedTemplateHandler(), getNamespacedTemplateHandler()];

export default handlers;

function nameToUid(name: string) {
  return `k8s-${name}-uid`;
}
