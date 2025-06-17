import { QueryBuilderLabelFilter } from './types';

export function buildMetricQuery(metric: string, labels: QueryBuilderLabelFilter[]) {
  let expr = metric;
  if (labels.length > 0) {
    expr = `${metric}{${labels.map(renderLabelFilter).join(',')}}`;
  }
  return expr;
}

function renderLabelFilter(label: QueryBuilderLabelFilter): string {
  if (label.value === '') {
    return `${label.label}=""`;
  }
  return `${label.label}${label.op}"${label.value}"`;
}
