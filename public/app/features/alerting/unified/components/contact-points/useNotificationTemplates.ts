import { useEffect } from 'react';
import { Validate } from 'react-hook-form';

import { notificationsAPIv0alpha1 } from '@grafana/alerting/unstable';
import {
  API_GROUP,
  API_VERSION,
  TemplateGroup,
  TemplateGroupList,
  TemplateGroupTemplateKind,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';

import { AlertManagerCortexConfig } from '../../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { useAsync } from '../../hooks/useAsync';
import { useProduceNewAlertmanagerConfiguration } from '../../hooks/useProduceNewAlertmanagerConfig';
import {
  addNotificationTemplateAction,
  deleteNotificationTemplateAction,
  updateNotificationTemplateAction,
} from '../../reducers/alertmanager/notificationTemplates';
import { KnownProvenance } from '../../types/knownProvenance';
import { K8sAnnotations } from '../../utils/k8s/constants';
import { getAnnotation, shouldUseK8sApi } from '../../utils/k8s/utils';
import { ensureDefine } from '../../utils/templates';
import { TemplateFormValues } from '../receivers/TemplateForm';

const apiVersion = `${API_GROUP}/${API_VERSION}`;
const kind = 'TemplateGroup';

interface BaseAlertmanagerArgs {
  alertmanager: string;
}

export interface NotificationTemplate {
  uid: string;
  title: string;
  content: string;
  provenance: string;
  missing?: boolean;
  /** The kind/source of the template - 'grafana' for native templates, 'mimir' for external */
  kind: TemplateGroupTemplateKind;
}

const { useGetAlertmanagerConfigurationQuery, useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;

const {
  useListTemplateGroupQuery,
  useLazyGetTemplateGroupQuery,
  useCreateTemplateGroupMutation,
  useReplaceTemplateGroupMutation,
  useDeleteTemplateGroupMutation,
} = notificationsAPIv0alpha1;

export function useNotificationTemplates({ alertmanager }: BaseAlertmanagerArgs) {
  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  const k8sApiTemplatesRequestState = useListTemplateGroupQuery(
    {},
    {
      skip: !k8sApiSupported,
      selectFromResult: (state) => ({
        ...state,
        data: state.data ? templateGroupsToTemplates(state.data) : undefined,
        currentData: state.currentData ? templateGroupsToTemplates(state.currentData) : undefined,
      }),
    }
  );

  const configApiTemplatesRequestState = useGetAlertmanagerConfigurationQuery(alertmanager, {
    skip: k8sApiSupported,
    selectFromResult: (state) => ({
      ...state,
      data: state.data ? amConfigToTemplates(state.data) : undefined,
      currentData: state.currentData ? amConfigToTemplates(state.currentData) : undefined,
    }),
  });

  return k8sApiSupported ? k8sApiTemplatesRequestState : configApiTemplatesRequestState;
}

function templateGroupsToTemplates(templateGroups: TemplateGroupList): NotificationTemplate[] {
  return templateGroups.items.map((templateGroup) => templateGroupToTemplate(templateGroup));
}

function templateGroupToTemplate(templateGroup: TemplateGroup): NotificationTemplate {
  const provenance = getAnnotation(templateGroup, K8sAnnotations.Provenance) ?? KnownProvenance.None;
  // The generated types are missing the `kind` field, but the API returns it.
  // We use a typed variable to safely access it without type assertions.
  return {
    // K8s entities should always have a metadata.name property. The type is marked as optional because it's also used in other places
    uid: templateGroup.metadata.name ?? templateGroup.spec.title,
    title: templateGroup.spec.title,
    content: templateGroup.spec.content,
    provenance,
    kind: templateGroup.spec.kind ?? 'grafana',
  };
}

function amConfigToTemplates(config: AlertManagerCortexConfig): NotificationTemplate[] {
  const { alertmanager_config } = config;
  const { templates = [] } = alertmanager_config;
  return Object.entries(config.template_files).map(([title, content]) => ({
    uid: title,
    title,
    content,
    // Undefined, null or empty string should be converted to KnownProvenance.None
    provenance: (config.template_file_provenances ?? {})[title] || KnownProvenance.None,
    missing: !templates.includes(title),
    kind: 'grafana', // Config API templates are always Grafana templates
  }));
}

interface GetTemplateParams extends BaseAlertmanagerArgs {
  uid: string;
}

export function useGetNotificationTemplate({ alertmanager, uid }: GetTemplateParams) {
  const [fetchAmConfig, amConfigStatus] = useLazyGetAlertmanagerConfigurationQuery({
    selectFromResult: (state) => ({
      ...state,
      data: state.data ? amConfigToTemplate(state.data, uid) : undefined,
      currentData: state.currentData ? amConfigToTemplate(state.currentData, uid) : undefined,
      // TODO set error and isError in case template is not found
    }),
  });
  const [fetchTemplate, templateStatus] = useLazyGetTemplateGroupQuery({
    selectFromResult: (state) => {
      return {
        ...state,
        data: state.data ? templateGroupToTemplate(state.data) : undefined,
        currentData: state.currentData ? templateGroupToTemplate(state.currentData) : undefined,
      };
    },
  });

  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  // TODO: Decide on a consistent approach for conditionally calling in our hooks -
  // useEffect? or using `skip` properly in RTKQ hooks?
  // What are pros and cons of each?
  useEffect(() => {
    if (k8sApiSupported) {
      fetchTemplate({ name: uid });
    } else {
      fetchAmConfig(alertmanager);
    }
  }, [alertmanager, uid, k8sApiSupported, fetchAmConfig, fetchTemplate]);

  return k8sApiSupported ? templateStatus : amConfigStatus;
}

function amConfigToTemplate(config: AlertManagerCortexConfig, name: string): NotificationTemplate | undefined {
  const templates = amConfigToTemplates(config);
  return templates.find((t) => t.title === name);
}

interface CreateTemplateParams {
  templateValues: TemplateFormValues;
}

export function useCreateNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const [createNamespacedTemplateGroup] = useCreateTemplateGroupMutation();
  const [updateAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();

  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  const createUsingConfigFileApi = useAsync(({ templateValues }: CreateTemplateParams) => {
    const action = addNotificationTemplateAction({ template: templateValues });
    return updateAlertmanagerConfiguration(action);
  });

  const createUsingK8sApi = useAsync(({ templateValues }: CreateTemplateParams) => {
    const content = ensureDefine(templateValues.title, templateValues.content);

    return createNamespacedTemplateGroup({
      templateGroup: {
        spec: { title: templateValues.title, content, kind: 'grafana' },
        metadata: {},
        apiVersion,
        kind,
      },
    }).unwrap();
  });

  return k8sApiSupported ? createUsingK8sApi : createUsingConfigFileApi;
}

interface UpdateTemplateParams {
  template: NotificationTemplate;
  patch: TemplateFormValues;
}

export function useUpdateNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const [replaceNamespacedTemplateGroup] = useReplaceTemplateGroupMutation();
  const [updateAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();

  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  const updateUsingConfigFileApi = useAsync(({ template, patch }: UpdateTemplateParams) => {
    const action = updateNotificationTemplateAction({ name: template.title, template: patch });
    return updateAlertmanagerConfiguration(action);
  });

  const updateUsingK8sApi = useAsync(({ template, patch }: UpdateTemplateParams) => {
    const content = ensureDefine(patch.title, patch.content);

    return replaceNamespacedTemplateGroup({
      name: template.uid,
      templateGroup: {
        spec: { title: patch.title, content, kind: template.kind },
        metadata: { name: template.uid },
        apiVersion,
        kind,
      },
    }).unwrap();
  });

  return k8sApiSupported ? updateUsingK8sApi : updateUsingConfigFileApi;
}

export function useDeleteNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const [deleteNamespacedTemplateGroup] = useDeleteTemplateGroupMutation();
  const [updateAlertmanagerConfiguration] = useProduceNewAlertmanagerConfiguration();

  const deleteUsingConfigAPI = useAsync(async ({ uid }: { uid: string }) => {
    const action = deleteNotificationTemplateAction({ name: uid });
    return updateAlertmanagerConfiguration(action);
  });

  const deleteUsingK8sApi = useAsync(({ uid }: { uid: string }) => {
    return deleteNamespacedTemplateGroup({
      name: uid,
    }).unwrap();
  });

  const k8sApiSupported = shouldUseK8sApi(alertmanager);
  return k8sApiSupported ? deleteUsingK8sApi : deleteUsingConfigAPI;
}

interface ValidateNotificationTemplateParams {
  alertmanager: string;
  originalTemplate?: NotificationTemplate;
}

export function useValidateNotificationTemplate({
  alertmanager,
  originalTemplate,
}: ValidateNotificationTemplateParams) {
  const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;
  const [fetchAmConfig] = useLazyGetAlertmanagerConfigurationQuery();

  const titleIsUnique: Validate<string, TemplateFormValues> = async (name) => {
    const k8sApiSupported = shouldUseK8sApi(alertmanager);

    if (k8sApiSupported) {
      // K8s API handles validation for us, so we can just return true
      // and rely on API errors
      return true;
    }

    if (originalTemplate?.title === name) {
      // If original template is defined we update existing template so name will not be unique but it's ok
      return true;
    }

    const amConfig = await fetchAmConfig(alertmanager).unwrap();
    const templates = amConfigToTemplates(amConfig);
    const templateOfThisNameExists = templates.some((t) => t.title === name);

    if (templateOfThisNameExists) {
      return 'Another template with this name already exists';
    }

    return true;
  };

  return {
    titleIsUnique,
  };
}

interface NotificationTemplateMetadata {
  provenance?: string;
}

export function useNotificationTemplateMetadata(
  template: NotificationTemplate | undefined
): NotificationTemplateMetadata {
  if (!template) {
    return {
      provenance: KnownProvenance.None,
    };
  }

  return {
    provenance: template.provenance,
  };
}
