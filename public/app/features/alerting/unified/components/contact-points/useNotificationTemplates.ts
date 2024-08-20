import { produce } from 'immer';
import { useEffect } from 'react';
import { Validate } from 'react-hook-form';

import { useDispatch } from 'app/types';

import { AlertManagerCortexConfig } from '../../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { templatesApi } from '../../api/templateApi';
import {
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup,
  ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroupList,
} from '../../openapi/templatesApi.gen';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { PROVENANCE_ANNOTATION, PROVENANCE_NONE } from '../../utils/k8s/constants';
import { shouldUseK8sApi, getK8sNamespace } from '../../utils/k8s/utils';
import { ensureDefine } from '../../utils/templates';
import { TemplateFormValues } from '../receivers/TemplateForm';

interface BaseAlertmanagerArgs {
  alertmanager: string;
}

export interface NotificationTemplate {
  uid: string;
  name: string;
  template: string;
  provenance: string;
}
export function useNotificationTemplates({ alertmanager }: BaseAlertmanagerArgs) {
  const { useGetAlertmanagerConfigurationQuery } = alertmanagerApi;
  const { useListNamespacedTemplateGroupQuery } = templatesApi;

  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  const k8sTemplatesRequestState = useListNamespacedTemplateGroupQuery(
    { namespace: getK8sNamespace() },
    {
      skip: !k8sApiSupported || alertmanager !== GRAFANA_RULES_SOURCE_NAME,
      selectFromResult: (state) => ({
        ...state,
        data: state.data ? templateGroupsToTemplates(state.data) : undefined,
        currentData: state.currentData ? templateGroupsToTemplates(state.currentData) : undefined,
      }),
    }
  );

  const templatesRequestState = useGetAlertmanagerConfigurationQuery(alertmanager, {
    skip: !alertmanager || k8sApiSupported,
    selectFromResult: (state) => ({
      ...state,
      data: state.data ? amConfigToTemplates(state.data) : undefined,
      currentData: state.currentData ? amConfigToTemplates(state.currentData) : undefined,
    }),
  });

  return k8sApiSupported ? k8sTemplatesRequestState : templatesRequestState;
}

function templateGroupsToTemplates(
  templateGroups: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroupList
): NotificationTemplate[] {
  return templateGroups.items.map((templateGroup) => templateGroupToTemplate(templateGroup));
}

function templateGroupToTemplate(
  templateGroup: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup
): NotificationTemplate {
  return {
    // K8s entities should always have a metadata.name property. The type is marked as optional because it's also used in other places
    uid: templateGroup.metadata.name ?? templateGroup.spec.title,
    name: templateGroup.spec.title,
    template: templateGroup.spec.content,
    provenance: templateGroup.metadata.annotations
      ? templateGroup.metadata.annotations[PROVENANCE_ANNOTATION]
      : PROVENANCE_NONE,
  };
}

function amConfigToTemplates(config: AlertManagerCortexConfig): NotificationTemplate[] {
  return Object.entries(config.template_files).map(([name, template]) => ({
    uid: name,
    name,
    template,
    // Undefined, null or empty string should be converted to PROVENANCE_NONE
    provenance: (config.template_file_provenances ?? {})[name] || PROVENANCE_NONE,
  }));
}

function amConfigToTemplate(config: AlertManagerCortexConfig, name: string): NotificationTemplate | undefined {
  const templates = amConfigToTemplates(config);
  return templates.find((t) => t.name === name);
}

interface GetTemplateParams extends BaseAlertmanagerArgs {
  uid: string;
}

export function useGetNotificationTemplate({ alertmanager, uid }: GetTemplateParams) {
  const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;
  const { useLazyReadNamespacedTemplateGroupQuery } = templatesApi;

  const [fetchAmConfig, amConfigStatus] = useLazyGetAlertmanagerConfigurationQuery({
    selectFromResult: (state) => ({
      ...state,
      data: state.data ? amConfigToTemplate(state.data, uid) : undefined,
      currentData: state.currentData ? amConfigToTemplate(state.currentData, uid) : undefined,
      // TODO set error and isError in case template is not found
    }),
  });
  const [fetchTemplate, templateStatus] = useLazyReadNamespacedTemplateGroupQuery({
    selectFromResult: (state) => ({
      ...state,
      data: state.data ? templateGroupToTemplate(state.data) : undefined,
      currentData: state.currentData ? templateGroupToTemplate(state.currentData) : undefined,
    }),
  });

  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  useEffect(() => {
    if (k8sApiSupported) {
      fetchTemplate({ namespace: getK8sNamespace(), name: uid });
    } else {
      fetchAmConfig(alertmanager);
    }
  }, [alertmanager, uid, k8sApiSupported, fetchAmConfig, fetchTemplate]);

  return k8sApiSupported ? templateStatus : amConfigStatus;
}

interface CreateTemplateParams {
  templateValues: TemplateFormValues;
}

export function useCreateNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const dispatch = useDispatch();
  const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;
  const { useCreateNamespacedTemplateGroupMutation } = templatesApi;

  const [fetchAmConfig] = useLazyGetAlertmanagerConfigurationQuery();
  const [createNamespacedTemplateGroup] = useCreateNamespacedTemplateGroupMutation();

  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  async function createUsingConfigFileApi({ templateValues }: CreateTemplateParams) {
    const amConfig = await fetchAmConfig(alertmanager).unwrap();
    // wrap content in "define" if it's not already wrapped, in case user did not do it/
    // it's not obvious that this is needed for template to work
    const content = ensureDefine(templateValues.name, templateValues.content);

    // TODO Check we're NOT overriding an existing template
    const updatedConfig = produce(amConfig, (draft) => {
      draft.template_files[templateValues.name] = content;
      draft.alertmanager_config.templates = [...(draft.alertmanager_config.templates ?? []), templateValues.name];
    });

    return dispatch(
      updateAlertManagerConfigAction({
        alertManagerSourceName: alertmanager,
        newConfig: updatedConfig,
        oldConfig: amConfig,
        successMessage: 'Template saved.',
      })
    ).unwrap();
  }

  async function createUsingK8sApi({ templateValues }: CreateTemplateParams) {
    const content = ensureDefine(templateValues.name, templateValues.content);

    return createNamespacedTemplateGroup({
      namespace: getK8sNamespace(),
      comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup: {
        spec: { title: templateValues.name, content },
        metadata: {},
      },
    }).unwrap();
  }

  return k8sApiSupported ? createUsingK8sApi : createUsingConfigFileApi;
}

interface UpdateTemplateParams {
  template: NotificationTemplate;
  patch: TemplateFormValues;
}

export function useUpdateNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const dispatch = useDispatch();
  const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;
  const { useReplaceNamespacedTemplateGroupMutation } = templatesApi;

  const [fetchAmConfig] = useLazyGetAlertmanagerConfigurationQuery();
  const [replaceNamespacedTemplateGroup] = useReplaceNamespacedTemplateGroupMutation();

  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  async function updateUsingConfigFileApi({ template, patch }: UpdateTemplateParams) {
    const amConfig = await fetchAmConfig(alertmanager).unwrap();
    // wrap content in "define" if it's not already wrapped, in case user did not do it/
    // it's not obvious that this is needed for template to work
    const content = ensureDefine(patch.name, patch.content);

    const originalName = template.name; // For ConfigFile API name is the same as uid
    const nameChanged = originalName !== patch.name;

    // TODO Maybe we could simplify or extract this logic
    const updatedConfig = produce(amConfig, (draft) => {
      if (nameChanged) {
        delete draft.template_files[originalName];
        draft.alertmanager_config.templates = draft.alertmanager_config.templates?.filter((t) => t !== originalName);
      }

      draft.template_files[patch.name] = content;
      draft.alertmanager_config.templates = [...(draft.alertmanager_config.templates ?? []), patch.name];
    });

    return dispatch(
      updateAlertManagerConfigAction({
        alertManagerSourceName: alertmanager,
        newConfig: updatedConfig,
        oldConfig: amConfig,
        successMessage: 'Template saved.',
      })
    ).unwrap();
  }

  async function updateUsingK8sApi({ template, patch }: UpdateTemplateParams) {
    const content = ensureDefine(patch.name, patch.content);

    return replaceNamespacedTemplateGroup({
      namespace: getK8sNamespace(),
      name: template.uid,
      comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup: {
        spec: { title: patch.name, content },
        metadata: { name: template.uid },
      },
    }).unwrap();
  }

  return k8sApiSupported ? updateUsingK8sApi : updateUsingConfigFileApi;
}

export function useDeleteNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const dispatch = useDispatch();
  const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;
  const { useDeleteNamespacedTemplateGroupMutation } = templatesApi;

  const [fetchAmConfig] = useLazyGetAlertmanagerConfigurationQuery();
  const [deleteNamespacedTemplateGroup] = useDeleteNamespacedTemplateGroupMutation();

  async function deleteUsingConfigFileApi({ uid }: { uid: string }) {
    const amConfig = await fetchAmConfig(alertmanager).unwrap();

    const updatedConfig = produce(amConfig, (draft) => {
      delete draft.template_files[uid];
      draft.alertmanager_config.templates = draft.alertmanager_config.templates?.filter((t) => t !== uid);
    });

    return dispatch(
      updateAlertManagerConfigAction({
        alertManagerSourceName: alertmanager,
        newConfig: updatedConfig,
        oldConfig: amConfig,
        successMessage: 'Template deleted.',
      })
    ).unwrap();
  }

  async function deleteUsingK8sApi({ uid }: { uid: string }) {
    return deleteNamespacedTemplateGroup({
      namespace: getK8sNamespace(),
      name: uid,
      ioK8SApimachineryPkgApisMetaV1DeleteOptions: {},
    }).unwrap();
  }

  const k8sApiSupported = shouldUseK8sApi(alertmanager);
  return k8sApiSupported ? deleteUsingK8sApi : deleteUsingConfigFileApi;
}

export function useValidateNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;
  const [fetchAmConfig] = useLazyGetAlertmanagerConfigurationQuery();

  const nameIsUnique: Validate<string, TemplateFormValues> = async (name) => {
    const k8sApiSupported = shouldUseK8sApi(alertmanager);

    if (!k8sApiSupported) {
      const amConfig = await fetchAmConfig(alertmanager).unwrap();
      const templates = amConfigToTemplates(amConfig);
      const templateOfThisNameExists = templates.some((t) => t.name === name);

      if (templateOfThisNameExists) {
        return 'Another template with this name already exists';
      }
    }

    // K8s API handle validation for us, so we can just return true
    return true;
  };

  return {
    nameIsUnique,
  };
}
