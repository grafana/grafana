import { e2e } from '../index';

export const assertSuccessNotification = () => {
  if (e2e.components.Alert.alertV2) {
    e2e.components.Alert.alertV2('success').should('exist');
  } else {
    e2e.components.Alert.alert('success').should('exist');
  }
};
