import React from 'react';

const ulPadding = { paddingLeft: 30 };

export const OrganizeFieldsHelper = () => {
  return (
    <div>
      <p>Use this transformation to rename, reorder, or hide fields returned by the query.</p>
      <blockquote>
        <strong>Note:</strong> This transformation only works in panels with a single query. If your panel has multiple
        queries, then you must either apply an Outer join transformation or remove the extra queries.
      </blockquote>
      <p>Grafana displays a list of fields returned by the query. You can:</p>
      <ul style={ulPadding}>
        <li>
          Change field order by hovering your cursor over a field. The cursor turns into a hand and then you can drag
          the field to its new place.
        </li>
        <li>Hide or show a field by clicking the eye icon next to the field name.</li>
        <li>
          Rename fields by typing a new name in the <strong>Rename</strong>
          box.
        </li>
      </ul>
    </div>
  );
};
