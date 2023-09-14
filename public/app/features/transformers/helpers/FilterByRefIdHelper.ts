import { getLinkToDocs } from './getLinkToDocs';

export const filterByRefIdHelper = () => {
  return `
  Use this transformation in panels that have multiple queries, if you want to hide one or more of the queries.

  Grafana displays the query identification letters in dark gray text. Click a query identifier to toggle filtering. If the query letter is white, then the results are displayed. If the query letter is dark, then the results are hidden.

  In the example below, the panel has three queries (A, B, C). I removed the B query from the visualization.

  > **Note:** This transformation is not available for Graphite because this data source does not support correlating returned data with queries.
  ${getLinkToDocs()}
  `;
};
