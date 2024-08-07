import { produce } from 'immer';

import { useDispatch } from 'app/types';

import { AlertManagerCortexConfig } from '../../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { PROVENANCE_NONE } from '../../utils/k8s/constants';
import { ensureDefine } from '../../utils/templates';
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

  const templatesRequestState = useGetAlertmanagerConfigurationQuery(alertmanager, {
    skip: !alertmanager,
    selectFromResult: (state) => ({
      ...state,
      data: state.data ? amConfigToTemplates(state.data) : undefined,
      currentData: state.currentData ? amConfigToTemplates(state.currentData) : undefined,
    }),
  });

  return templatesRequestState;
}

function amConfigToTemplates(config: AlertManagerCortexConfig): NotificationTemplate[] {
  return Object.entries(config.template_files).map(([name, template]) => ({
    name,
    template,
    // Undefined, null or empty string should be converted to PROVENANCE_NONE
    provenance: (config.template_file_provenances ?? {})[name] || PROVENANCE_NONE,
  }));
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
