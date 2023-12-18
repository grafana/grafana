import { Messages } from './components/AddRemoteInstance/AddRemoteInstance.messages';
import { InstanceAvailableType, InstanceTypesExtra, INSTANCE_TYPES_LABELS } from './panel.types';

export const getHeader = (databaseType: InstanceAvailableType) => {
  if (databaseType === InstanceTypesExtra.external) {
    return Messages.form.titles.addExternalService;
  }
  if (databaseType === '') {
    return Messages.form.titles.addRemoteInstance;
  }
  return `Configuring ${INSTANCE_TYPES_LABELS[databaseType]} service`;
};
