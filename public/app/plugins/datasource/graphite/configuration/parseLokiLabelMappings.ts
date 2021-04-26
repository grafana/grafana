export type MetricMapping = {
  matchers: MetricNodeMatcher[];
};

export type MetricNodeMatcher = {
  value: string;
  labelName?: string;
};

export function fromString(text: string): MetricMapping {
  return {
    matchers: text.split('.').map((metricNode) => {
      if (metricNode.startsWith('(') && metricNode.endsWith(')')) {
        return {
          value: '*',
          labelName: metricNode.slice(1, -1),
        };
      } else {
        return { value: metricNode };
      }
    }),
  };
}

export function toString(mapping: MetricMapping): string {
  return mapping.matchers
    .map((matcher) => {
      return matcher.labelName ? `(${matcher.labelName})` : `${matcher.value}`;
    })
    .join('.');
}
