import { AlertManagerCortexConfig } from '../../../../../plugins/datasource/alertmanager/types';
import { alertmanagerApi } from '../../api/alertmanagerApi';

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

export function useCreateNotificationTemplate(amSourceName?: string) {}

export function useUpdateNotificationTemplate(amSourceName?: string) {}

export function useDeleteNotificationTemplate(amSourceName?: string) {}
