/**
 * Ad hoc filtering from the tooltip is a dashboard affordance driven by a feature
 * flag read through @grafana/runtime/internal. The real function already returns
 * undefined when that flag is off, so undefined is the correct embed semantic.
 */
export function getFilterByGroupedLabels(): undefined {
  return undefined;
}

export function getGroupedFilters(): undefined {
  return undefined;
}
