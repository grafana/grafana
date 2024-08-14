import { produce } from 'immer';
import { useEffect } from 'react';

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
import { shouldUseK8sApi } from '../../utils/k8s/utils';
import { ensureDefine } from '../../utils/templates';
import { getK8sNamespace } from '../mute-timings/util';
import { TemplateFormValues } from '../receivers/TemplateForm';

interface BaseAlertmanagerArgs {
  alertmanager: string;
}

export interface NotificationTemplate {
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
    name: templateGroup.spec.title,
    template: templateGroup.spec.content,
    provenance: templateGroup.metadata.annotations
      ? templateGroup.metadata.annotations[PROVENANCE_ANNOTATION]
      : PROVENANCE_NONE,
  };
}

function amConfigToTemplates(config: AlertManagerCortexConfig): NotificationTemplate[] {
  return Object.entries(config.template_files).map(([name, template]) => ({
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
  name: string;
}

export function useGetNotificationTemplate({ alertmanager, name }: GetTemplateParams) {
  const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;
  const { useLazyReadNamespacedTemplateGroupQuery } = templatesApi;

  const [fetchAmConfig, amConfigStatus] = useLazyGetAlertmanagerConfigurationQuery({
    selectFromResult: (state) => ({
      ...state,
      data: state.data ? amConfigToTemplate(state.data, name) : undefined,
      currentData: state.currentData ? amConfigToTemplate(state.currentData, name) : undefined,
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
      fetchTemplate({ namespace: getK8sNamespace(), name });
    } else {
      fetchAmConfig(alertmanager);
    }
  }, [alertmanager, name, k8sApiSupported, fetchAmConfig, fetchTemplate]);

  return k8sApiSupported ? templateStatus : amConfigStatus;
}

export function useCreateNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const dispatch = useDispatch();
  const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;

  const [fetchAmConfig] = useLazyGetAlertmanagerConfigurationQuery();

  return async ({ template }: { template: TemplateFormValues }) => {
    const amConfig = await fetchAmConfig(alertmanager).unwrap();
    // wrap content in "define" if it's not already wrapped, in case user did not do it/
    // it's not obvious that this is needed for template to work
    const content = ensureDefine(template.name, template.content);

    // TODO Check we're NOT overriding an existing template
    const updatedConfig = produce(amConfig, (draft) => {
      draft.template_files[template.name] = content;
      draft.alertmanager_config.templates = [...(draft.alertmanager_config.templates ?? []), template.name];
    });

    return dispatch(
      updateAlertManagerConfigAction({
        alertManagerSourceName: alertmanager,
        newConfig: updatedConfig,
        oldConfig: amConfig,
        successMessage: 'Template saved.',
      })
    ).unwrap();
  };
}

export function useUpdateNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const dispatch = useDispatch();
  const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;

  const [fetchAmConfig] = useLazyGetAlertmanagerConfigurationQuery();

  return async ({ originalName, template }: { originalName: string; template: TemplateFormValues }) => {
    const amConfig = await fetchAmConfig(alertmanager).unwrap();
    // wrap content in "define" if it's not already wrapped, in case user did not do it/
    // it's not obvious that this is needed for template to work
    const content = ensureDefine(template.name, template.content);

    const nameChanged = originalName !== template.name;

    // TODO Maybe we could simplify or extract this logic
    const updatedConfig = produce(amConfig, (draft) => {
      if (nameChanged) {
        delete draft.template_files[originalName];
        draft.alertmanager_config.templates = draft.alertmanager_config.templates?.filter((t) => t !== originalName);
      }

      draft.template_files[template.name] = content;
      draft.alertmanager_config.templates = [...(draft.alertmanager_config.templates ?? []), template.name];
    });

    return dispatch(
      updateAlertManagerConfigAction({
        alertManagerSourceName: alertmanager,
        newConfig: updatedConfig,
        oldConfig: amConfig,
        successMessage: 'Template saved.',
      })
    ).unwrap();
  };
}

export function useDeleteNotificationTemplate({ alertmanager }: BaseAlertmanagerArgs) {
  const dispatch = useDispatch();
  const { useLazyGetAlertmanagerConfigurationQuery } = alertmanagerApi;

  const [fetchAmConfig] = useLazyGetAlertmanagerConfigurationQuery();

  return async ({ name }: { name: string }) => {
    const amConfig = await fetchAmConfig(alertmanager).unwrap();

    const updatedConfig = produce(amConfig, (draft) => {
      delete draft.template_files[name];
      draft.alertmanager_config.templates = draft.alertmanager_config.templates?.filter((t) => t !== name);
    });

    return dispatch(
      updateAlertManagerConfigAction({
        alertManagerSourceName: alertmanager,
        newConfig: updatedConfig,
        oldConfig: amConfig,
        successMessage: 'Template deleted.',
      })
    ).unwrap();
  };
}
