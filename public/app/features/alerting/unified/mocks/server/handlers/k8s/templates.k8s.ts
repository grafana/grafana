import { HttpResponse, http } from 'msw';

import { TemplateGroupTemplateKind } from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { getAlertmanagerConfig } from 'app/features/alerting/unified/mocks/server/entities/alertmanagers';
import { ALERTING_API_SERVER_BASE_URL, getK8sResponse } from 'app/features/alerting/unified/mocks/server/utils';
import { ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup } from 'app/features/alerting/unified/openapi/templatesApi.gen';
import { KnownProvenance } from 'app/features/alerting/unified/types/knownProvenance';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { PROVENANCE_ANNOTATION } from 'app/features/alerting/unified/utils/k8s/constants';

const config = getAlertmanagerConfig(GRAFANA_RULES_SOURCE_NAME);

type TemplateGroupSpecWithKind = ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup['spec'] & {
  kind?: TemplateGroupTemplateKind;
};

// Map alertmanager templates to k8s templates
const mappedTemplates = Object.entries(
  config.template_files || {}
).map<ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup>(([title, template]) => ({
  metadata: {
    name: titleToK8sResourceName(title), // K8s uses unique identifiers for resources
    annotations: { [PROVENANCE_ANNOTATION]: config.template_file_provenances?.[title] || KnownProvenance.None },
  },
  spec: {
    title: title,
    content: template,
    kind: 'grafana',
  } as TemplateGroupSpecWithKind,
}));

const templatesDb = new Map<string, ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup>(
  mappedTemplates.map((t) => [t.metadata.name!, t])
);

const listNamespacedTemplateHandler = () =>
  http.get<{ namespace: string }>(`${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/templategroups`, () => {
    const parsedTemplates = getK8sResponse<ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup>(
      'TemplateGroupList',
      Array.from(templatesDb.values())
    );

    return HttpResponse.json(parsedTemplates);
  });

const getNamespacedTemplateHandler = () =>
  http.get<{ namespace: string; name: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/templategroups/:name`,
    ({ params: { name } }) => {
      const template = templatesDb.get(name);

      if (!template) {
        return HttpResponse.json({ message: 'NotFound' }, { status: 404 });
      }

      return HttpResponse.json(template);
    }
  );

const putNamespacedTemplateHandler = () =>
  http.put<
    { namespace: string; name: string },
    ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup
  >(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/templategroups/:name`,
    async ({ params: { name }, request }) => {
      const template = templatesDb.get(name);

      if (!template) {
        return HttpResponse.json({ message: 'NotFound' }, { status: 404 });
      }

      const updatedTemplate = await request.json();
      templatesDb.set(name, updatedTemplate);

      return HttpResponse.json(updatedTemplate);
    }
  );

const deleteNamespacedTemplateHandler = () =>
  http.delete<{ namespace: string; name: string }>(
    `${ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/templategroups/:name`,
    ({ params: { name } }) => {
      const template = templatesDb.get(name);

      if (!template) {
        return HttpResponse.json({ message: 'NotFound' }, { status: 404 });
      }

      templatesDb.delete(name);

      return HttpResponse.json(template);
    }
  );

const handlers = [
  listNamespacedTemplateHandler(),
  getNamespacedTemplateHandler(),
  putNamespacedTemplateHandler(),
  deleteNamespacedTemplateHandler(),
];

export default handlers;

function titleToK8sResourceName(title: string) {
  return `k8s-${title}-resource-name`;
}

export function addTemplateToDb(title: string, content: string, kind: TemplateGroupTemplateKind = 'grafana'): void {
  const name = titleToK8sResourceName(title);
  templatesDb.set(name, {
    metadata: {
      name,
      annotations: { [PROVENANCE_ANNOTATION]: KnownProvenance.None },
    },
    spec: {
      title,
      content,
      kind,
    } as TemplateGroupSpecWithKind,
  });
}

export function clearTemplatesDb(): void {
  templatesDb.clear();
}

export function resetTemplatesDb(): void {
  templatesDb.clear();
  mappedTemplates.forEach((t) => templatesDb.set(t.metadata.name!, t));
}
