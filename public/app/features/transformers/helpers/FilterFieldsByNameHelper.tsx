import React from 'react';

const ulPadding = { paddingLeft: 30 };

export const FilterFieldsByNameHelper = () => {
  return (
    <div>
      <p>Use this transformation to remove portions of the query results.</p>
      <p>
        Grafana displays the <strong>Identifier</strong> field, followed by the fields returned by your query.
      </p>
      <p>You can apply filters in one of two ways:</p>
      <ul style={ulPadding}>
        <li>Enter a regex expression.</li>
        <li>
          Click a field to toggle filtering on that field. Filtered fields are displayed with dark gray text, unfiltered
          fields have white text.
        </li>
      </ul>
    </div>
  );
};
