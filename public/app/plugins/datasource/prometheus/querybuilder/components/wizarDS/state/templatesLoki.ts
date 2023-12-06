import { Suggestion } from '../types';

export const componentTemplates: Suggestion[] = [
  {
    component: 'Kickstart your query',
    explanation: `Click to see a list of operation patterns that help you quickly get started adding multiple operations to your query. These include:
      \n
      \n
      Rate query starters
      \n
      Histogram query starters
      \n
      Binary query starters`,
    testid: 'wizard-prometheus-kickstart-your-query',
    order: 1,
    link: 'https://grafana.com/docs/grafana/latest/datasources/prometheus/query-editor/#toolbar-elements',
  },
];
