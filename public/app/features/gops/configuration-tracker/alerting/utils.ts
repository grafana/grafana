import { Receiver } from 'app/plugins/datasource/alertmanager/types';
const DEFAULT_EMAIL = '<example@email.com>';

export function isContactPointReady(defaultContactPoint: string, contactPoints: Receiver[]) {
  // We consider the contact point ready if the default contact is no longer referencing the default email address
  const matchingDefaultContactPoint = contactPoints.find(
    (contactPoint: Receiver) => contactPoint.name === defaultContactPoint
  );

  if (!matchingDefaultContactPoint) {
    return false;
  }

  return matchingDefaultContactPoint.grafana_managed_receiver_configs?.some((receiver) => {
    const isEmailReceiver = receiver.type === 'email';
    if (isEmailReceiver) {
      return receiver.settings?.addresses !== DEFAULT_EMAIL;
    } else {
      return true;
    }
  });
}
