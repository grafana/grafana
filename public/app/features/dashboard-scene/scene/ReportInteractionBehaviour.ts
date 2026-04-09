import { reportInteraction } from '@grafana/runtime';

export function createReportInteractionBehavior() {
  const behavior = () => {};
  behavior.isReportInteractionBehavior = true as const;
  behavior.reportInteraction = (interactionName: string, properties?: Record<string, unknown>) => {
    reportInteraction(interactionName, properties);
  };
  return behavior;
}
