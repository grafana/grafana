import { getBackendSrv } from '@grafana/runtime';

const API_VERSION = 'v1alpha1';
const GROUP = 'orgtemplate.grafana.app';
const RESOURCE = 'orgdashboardtemplates';

function getBaseUrl(namespace: string): string {
  return `/apis/${GROUP}/${API_VERSION}/namespaces/${namespace}/${RESOURCE}`;
}

export interface OrgDashboardTemplateSpec {
  title: string;
  description: string;
  tags: string[];
  sourceDashboardUID?: string;
  dashboard: unknown; // v2 DashboardSpec
}

export interface OrgDashboardTemplate {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace: string;
    uid?: string;
    resourceVersion?: string;
    creationTimestamp?: string;
    annotations?: Record<string, string>;
  };
  spec: OrgDashboardTemplateSpec;
}

export interface OrgDashboardTemplateList {
  apiVersion: string;
  kind: string;
  items: OrgDashboardTemplate[];
}

export async function listOrgTemplates(namespace: string): Promise<OrgDashboardTemplateList> {
  return getBackendSrv().get<OrgDashboardTemplateList>(getBaseUrl(namespace));
}

export async function getOrgTemplate(namespace: string, name: string): Promise<OrgDashboardTemplate> {
  return getBackendSrv().get<OrgDashboardTemplate>(`${getBaseUrl(namespace)}/${name}`);
}

export async function createOrgTemplate(
  namespace: string,
  spec: OrgDashboardTemplateSpec
): Promise<OrgDashboardTemplate> {
  return getBackendSrv().post<OrgDashboardTemplate>(getBaseUrl(namespace), {
    apiVersion: `${GROUP}/${API_VERSION}`,
    kind: 'OrgDashboardTemplate',
    metadata: {
      generateName: 'orgtemplate-',
      namespace,
    },
    spec,
  });
}

export async function updateOrgTemplate(
  namespace: string,
  name: string,
  template: OrgDashboardTemplate
): Promise<OrgDashboardTemplate> {
  return getBackendSrv().put<OrgDashboardTemplate>(`${getBaseUrl(namespace)}/${name}`, template);
}

export async function deleteOrgTemplate(namespace: string, name: string): Promise<void> {
  return getBackendSrv().delete(`${getBaseUrl(namespace)}/${name}`);
}
