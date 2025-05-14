import { Alert, LoadingPlaceholder } from '@grafana/ui';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { stringifyErrorLike } from '../../utils/misc';
import { TemplatesTable } from '../receivers/TemplatesTable';

import { useNotificationTemplates } from './useNotificationTemplates';

export const NotificationTemplates = () => {
  const { selectedAlertmanager } = useAlertmanager();
  const { data: templates, isLoading, error } = useNotificationTemplates({ alertmanager: selectedAlertmanager ?? '' });

  if (error) {
    return <Alert title="Failed to fetch notification templates">{stringifyErrorLike(error)}</Alert>;
  }

  if (isLoading) {
    return <LoadingPlaceholder text="Loading notification templates" />;
  }

  if (templates) {
    return <TemplatesTable alertManagerName={selectedAlertmanager!} templates={templates} />;
  }

  return null;
};
