import { getLinkToDocs } from './getLinkToDocs';

export const filterFieldsByNameHelper = () => {
  return `
  Use this transformation to remove portions of the query results.

  Grafana displays the **Identifier** field, followed by the fields returned by your query.

  You can apply filters in one of two ways:

  - Enter a regex expression.
  - Click a field to toggle filtering on that field. Filtered fields are displayed with dark gray text, unfiltered fields have white text.
  ${getLinkToDocs()}
  `;
};
