import { useAlertmanager } from '../../state/AlertmanagerContext';
import { NewReceiverView } from '../receivers/NewReceiverView';

const NewContactPoint = () => {
  const { selectedAlertmanager } = useAlertmanager();

  return <NewReceiverView alertManagerSourceName={selectedAlertmanager!} />;
};

export default NewContactPoint;
