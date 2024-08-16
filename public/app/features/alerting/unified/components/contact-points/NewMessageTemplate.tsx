import { EntityNotFound } from 'app/core/components/PageNotFound/EntityNotFound';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { TemplateForm } from '../receivers/TemplateForm';

const NewMessageTemplate = () => {
  const { selectedAlertmanager } = useAlertmanager();

  if (!selectedAlertmanager) {
    return <EntityNotFound entity="Alertmanager" />;
  }

  return <TemplateForm alertManagerSourceName={selectedAlertmanager} />;
};

export default NewMessageTemplate;
