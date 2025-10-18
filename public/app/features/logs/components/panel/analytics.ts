import { reportInteraction } from '@grafana/runtime';

export const reportInteractionOnce = (interactionName: string, properties?: Record<string, unknown>) => {
  const key = `logs.interactions.${interactionName}`;
  if (sessionStorage.getItem(key)) {
    return;
  }
  sessionStorage.setItem(key, '1');
  reportInteraction(interactionName, properties);
};
