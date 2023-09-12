import { getLinkToDocs } from './getLinkToDocs';

export const OrganizeFieldsHelper = () => {
  return `
  Use this transformation to rename, reorder, or hide fields returned by the query.

  > **Note:** This transformation only works in panels with a single query. If your panel has multiple queries, then you must either apply an Outer join transformation or remove the extra queries.

  Grafana displays a list of fields returned by the query. You can:

  - Change field order by hovering your cursor over a field. The cursor turns into a hand and then you can drag the field to its new place.
  - Hide or show a field by clicking the eye icon next to the field name.
  - Rename fields by typing a new name in the **Rename <field>** box.
  ${getLinkToDocs()}
  `;
};
