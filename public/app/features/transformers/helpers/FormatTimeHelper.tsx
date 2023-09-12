import React from 'react';

export const FormatTimeHelper = () => {
  return (
    <div>
      <blockquote>
        <strong>Note:</strong> This transformation is available in Grafana 10.1+ as an alpha feature.
      </blockquote>
      <p>
        Use this transformation to format the output of a time field. Output can be formatted using{' '}
        <a href="https://momentjs.com/docs/#/displaying/" target="_blank" rel="noopener noreferrer">
          Moment.js format strings
        </a>
        .
      </p>
      <p>
        For instance, if you would like to display only the year of a time field, the format string <code>YYYY</code>{' '}
        can be used to show the calendar year (e.g., 1999, 2012, etc.).
      </p>
    </div>
  );
};
