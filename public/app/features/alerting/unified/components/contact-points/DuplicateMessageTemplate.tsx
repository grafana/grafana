import { RouteChildrenProps } from 'react-router-dom';

import { Alert, LoadingPlaceholder } from '@grafana/ui';
import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { isNotFoundError } from '../../api/util';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { generateCopiedName } from '../../utils/duplicate';
import { stringifyErrorLike } from '../../utils/misc';
import { updateDefinesWithUniqueValue } from '../../utils/templates';
import { TemplateForm } from '../receivers/TemplateForm';

import { useGetNotificationTemplate, useNotificationTemplates } from './useNotificationTemplates';

type Props = RouteChildrenProps<{ name: string }>;

const notFoundComponent = <EntityNotFound entity="Notification template" />;

const DuplicateMessageTemplate = ({ match }: Props) => {
  const { selectedAlertmanager } = useAlertmanager();
  const templateUid = match?.params.name ? decodeURIComponent(match?.params.name) : undefined;

  const {
    currentData: template,
    isLoading,
    error,
  } = useGetNotificationTemplate({ alertmanager: selectedAlertmanager ?? '', uid: templateUid ?? '' });

  const {
    currentData: templates,
    isLoading: templatesLoading,
    error: templatesError,
  } = useNotificationTemplates({ alertmanager: selectedAlertmanager ?? '' });

  if (!selectedAlertmanager) {
    return <EntityNotFound entity="Alertmanager" />;
  }

  if (!templateUid) {
    return <EntityNotFound entity="Notification template" />;
  }

  if (isLoading || templatesLoading) {
    return <LoadingPlaceholder text="Loading notification template" />;
  }

  if (error || templatesError || !template || !templates) {
    return isNotFoundError(error) ? (
      notFoundComponent
    ) : (
      <Alert title="Error loading notification template" severity="error">
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  const duplicatedName = generateCopiedName(template.title, templates?.map((t) => t.title) ?? []);

  return (
    <TemplateForm
      alertmanager={selectedAlertmanager}
      prefill={{ title: duplicatedName, content: updateDefinesWithUniqueValue(template.content) }}
    />
  );
};

export default DuplicateMessageTemplate;
