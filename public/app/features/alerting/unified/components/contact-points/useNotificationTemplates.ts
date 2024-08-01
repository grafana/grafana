import { produce } from 'immer';

import { ActiveTab as ContactPointsActiveTabs } from 'app/features/alerting/unified/components/contact-points/ContactPoints';
import { useDispatch } from 'app/types';

import { AlertManagerCortexConfig } from '../../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../../api/alertmanagerApi';
import { updateAlertManagerConfigAction } from '../../state/actions';
import { ensureDefine } from '../../utils/templates';
import { TemplateFormValues } from '../receivers/TemplateForm';

// TODO Check the issue with useAlertmanagerConfig hook
export function useNotificationTemplates(amSourceName?: string) {
  const templatesRequestState = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useQuery(amSourceName || '', {
    skip: !amSourceName,
    selectFromResult: (state) => ({
      ...state,
      data: state.data ? amConfigToTemplates(state.data) : undefined,
      currentData: state.currentData ? amConfigToTemplates(state.currentData) : undefined,
    }),
  });

  return templatesRequestState;
}

export interface NotificationTemplate {
  name: string;
  template: string;
  provenance?: string;
}

function amConfigToTemplates(config: AlertManagerCortexConfig): NotificationTemplate[] {
  return Object.entries(config.template_files).map(([name, template]) => ({
    name,
    template,
    provenance: (config.template_file_provenances ?? {})[name],
  }));
}

export function useCreateNotificationTemplate(amSourceName?: string) {
  const dispatch = useDispatch();
  const [fetchAmConfig] = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useLazyQuery();

  return async (templateValues: TemplateFormValues) => {
    if (!amSourceName) {
      return Promise.reject(new Error('Alertmanager source name is required.'));
    }

    const amConfig = await fetchAmConfig(amSourceName).unwrap();
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
        alertManagerSourceName: amSourceName,
        newConfig: updatedConfig,
        oldConfig: amConfig,
        successMessage: 'Template saved.',
        redirectPath: '/alerting/notifications',
        redirectSearch: `tab=${ContactPointsActiveTabs.NotificationTemplates}`,
      })
    ).unwrap();
  };
}

export function useUpdateNotificationTemplate(amSourceName?: string) {
  const dispatch = useDispatch();
  const [fetchAmConfig] = alertmanagerApi.endpoints.getAlertmanagerConfiguration.useLazyQuery();

  return async (oldTemplateName: string, newTemplate: TemplateFormValues) => {
    if (!amSourceName) {
      return Promise.reject(new Error('Alertmanager source name is required.'));
    }

    const amConfig = await fetchAmConfig(amSourceName).unwrap();
    // wrap content in "define" if it's not already wrapped, in case user did not do it/
    // it's not obvious that this is needed for template to work
    const content = ensureDefine(newTemplate.name, newTemplate.content);

    const nameChanged = oldTemplateName !== newTemplate.name;

    // TODO Maybe we could simplify or extract this logic
    const updatedConfig = produce(amConfig, (draft) => {
      if (nameChanged) {
        delete draft.template_files[oldTemplateName];
        draft.alertmanager_config.templates = draft.alertmanager_config.templates?.filter((t) => t !== oldTemplateName);
      }

      draft.template_files[newTemplate.name] = content;
      draft.alertmanager_config.templates = [...(draft.alertmanager_config.templates ?? []), newTemplate.name];
    });

    return dispatch(
      updateAlertManagerConfigAction({
        alertManagerSourceName: amSourceName,
        newConfig: updatedConfig,
        oldConfig: amConfig,
        successMessage: 'Template saved.',
        redirectPath: '/alerting/notifications',
        redirectSearch: `tab=${ContactPointsActiveTabs.NotificationTemplates}`,
      })
    ).unwrap();
  };
}

export function useDeleteNotificationTemplate(amSourceName?: string) {}
