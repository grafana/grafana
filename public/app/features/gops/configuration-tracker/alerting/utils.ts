import { Receiver } from 'app/plugins/datasource/alertmanager/types';
const DEFAULT_EMAIL = '<example@email.com>';

export function isContactPointReady(defaultContactPoint: string, contactPoints: Receiver[]) {
  // We consider the contact point ready if the default contact has the address filled
  const defaultEmailUpdated = contactPoints.some(
    (contactPoint: Receiver) =>
      contactPoint.name === defaultContactPoint &&
      contactPoint.grafana_managed_receiver_configs?.some((receiver) => {
        const isEmailReceiver = receiver.type === 'email';
        const addresses = receiver.settings?.addresses;
        return isEmailReceiver && addresses && addresses !== DEFAULT_EMAIL;
      })
  );
  return defaultEmailUpdated;
}
