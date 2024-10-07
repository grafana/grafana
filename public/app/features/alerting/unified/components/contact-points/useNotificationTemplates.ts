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
import { K8sAnnotations, PROVENANCE_NONE } from '../../utils/k8s/constants';
import { getAnnotation, getK8sNamespace, shouldUseK8sApi } from '../../utils/k8s/utils';
import { ensureDefine } from '../../utils/templates';
import { TemplateFormValues } from '../receivers/TemplateForm';

interface BaseAlertmanagerArgs {
  alertmanager: string;
}

export interface NotificationTemplate {
  uid: string;
  title: string;
  content: string;
  provenance: string;
}

const { useGetAlertmanagerConfigurationQuery, useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;
const {
  useListNamespacedTemplateGroupQuery,
  useLazyReadNamespacedTemplateGroupQuery,
  useCreateNamespacedTemplateGroupMutation,
  useReplaceNamespacedTemplateGroupMutation,
  useDeleteNamespacedTemplateGroupMutation,
} = templatesApi;

export function useNotificationTemplates({ alertmanager }: BaseAlertmanagerArgs) {
  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  const k8sApiTemplatesRequestState = useListNamespacedTemplateGroupQuery(
    { namespace: getK8sNamespace() },
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

function templateGroupsToTemplates(
  templateGroups: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroupList
): NotificationTemplate[] {
  return templateGroups.items.map((templateGroup) => templateGroupToTemplate(templateGroup));
}

function templateGroupToTemplate(
  templateGroup: ComGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup
): NotificationTemplate {
  const provenance = getAnnotation(templateGroup, K8sAnnotations.Provenance) ?? PROVENANCE_NONE;
  return {
    // K8s entities should always have a metadata.name property. The type is marked as optional because it's also used in other places
    uid: templateGroup.metadata.name ?? templateGroup.spec.title,
    title: templateGroup.spec.title,
    content: templateGroup.spec.content,
    provenance,
  };
}

function amConfigToTemplates(config: AlertManagerCortexConfig): NotificationTemplate[] {
  return Object.entries(config.template_files).map(([title, content]) => ({
    uid: title,
    title,
    content,
    // Undefined, null or empty string should be converted to PROVENANCE_NONE
    provenance: (config.template_file_provenances ?? {})[title] || PROVENANCE_NONE,
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
  const [fetchTemplate, templateStatus] = useLazyReadNamespacedTemplateGroupQuery({
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
      fetchTemplate({ namespace: getK8sNamespace(), name: uid });
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
  const dispatch = useDispatch();

  const [fetchAmConfig] = useLazyGetAlertmanagerConfigurationQuery();
  const [createNamespacedTemplateGroup] = useCreateNamespacedTemplateGroupMutation();

  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  async function createUsingConfigFileApi({ templateValues }: CreateTemplateParams) {
    const amConfig = await fetchAmConfig(alertmanager).unwrap();
    // wrap content in "define" if it's not already wrapped, in case user did not do it/
    // it's not obvious that this is needed for template to work
    const content = ensureDefine(templateValues.title, templateValues.content);

    const targetTemplateExists = amConfig.template_files?.[templateValues.title] !== undefined;
    if (targetTemplateExists) {
      throw new Error('target template already exists');
    }

    const updatedConfig = produce(amConfig, (draft) => {
      draft.template_files[templateValues.title] = content;
      draft.alertmanager_config.templates = [...(draft.alertmanager_config.templates ?? []), templateValues.title];
    });

    return dispatch(
      updateAlertManagerConfigAction({
        alertManagerSourceName: alertmanager,
        newConfig: updatedConfig,
        oldConfig: amConfig,
      })
    ).unwrap();
  }

  async function createUsingK8sApi({ templateValues }: CreateTemplateParams) {
    const content = ensureDefine(templateValues.title, templateValues.content);

    return createNamespacedTemplateGroup({
      namespace: getK8sNamespace(),
      comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup: {
        spec: { title: templateValues.title, content },
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

  const [fetchAmConfig] = useLazyGetAlertmanagerConfigurationQuery();
  const [replaceNamespacedTemplateGroup] = useReplaceNamespacedTemplateGroupMutation();

  const k8sApiSupported = shouldUseK8sApi(alertmanager);

  async function updateUsingConfigFileApi({ template, patch }: UpdateTemplateParams) {
    const amConfig = await fetchAmConfig(alertmanager).unwrap();
    // wrap content in "define" if it's not already wrapped, in case user did not do it/
    // it's not obvious that this is needed for template to work
    const content = ensureDefine(patch.title, patch.content);

    const originalName = template.title; // For ConfigFile API name is the same as uid
    const nameChanged = originalName !== patch.title;

    // TODO Maybe we could simplify or extract this logic
    const updatedConfig = produce(amConfig, (draft) => {
      if (nameChanged) {
        delete draft.template_files[originalName];
        draft.alertmanager_config.templates = draft.alertmanager_config.templates?.filter((t) => t !== originalName);
      }

      draft.template_files[patch.title] = content;
      draft.alertmanager_config.templates = [...(draft.alertmanager_config.templates ?? []), patch.title];
    });

    return dispatch(
      updateAlertManagerConfigAction({
        alertManagerSourceName: alertmanager,
        newConfig: updatedConfig,
        oldConfig: amConfig,
      })
    ).unwrap();
  }

  async function updateUsingK8sApi({ template, patch }: UpdateTemplateParams) {
    const content = ensureDefine(patch.title, patch.content);

    return replaceNamespacedTemplateGroup({
      namespace: getK8sNamespace(),
      name: template.uid,
      comGithubGrafanaGrafanaPkgApisAlertingNotificationsV0Alpha1TemplateGroup: {
        spec: { title: patch.title, content },
        metadata: { name: template.uid },
      },
    }).unwrap();
  }

  return k8sApiSupported ? updateUsingK8sApi : updateUsingConfigFileApi;
}

export function useDeleteNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const dispatch = useDispatch();
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

  const titleIsUnique: Validate<string, TemplateFormValues> = async (name) => {
    const k8sApiSupported = shouldUseK8sApi(alertmanager);

    if (k8sApiSupported) {
      // K8s API handles validation for us, so we can just return true
      // and rely on API errors
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
  isProvisioned: boolean;
}

export function useNotificationTemplateMetadata(
  template: NotificationTemplate | undefined
): NotificationTemplateMetadata {
  if (!template) {
    return {
      isProvisioned: false,
    };
  }

  return {
    isProvisioned: Boolean(template.provenance) && template.provenance !== PROVENANCE_NONE,
  };
}
