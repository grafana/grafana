/**
 * The real module imports @grafana/assistant, which reaches api-clients and from
 * there the alerting web worker. Assistant context is a Grafana-app affordance:
 * an embedded panel has no assistant to hand context to.
 */
export function getAssistantTooltipContext(): undefined {
  return undefined;
}

export function buildDatapointAssistantContext(): undefined {
  return undefined;
}
