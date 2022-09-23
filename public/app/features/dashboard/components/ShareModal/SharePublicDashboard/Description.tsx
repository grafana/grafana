import React from 'react';

export const Description = () => (
  <>
    <p>
      To allow the current dashboard to be published publicly, toggle the switch. For now we do not support template
      variables or frontend datasources.
    </p>
    <p>
      We&apos;d love your feedback. To share, please comment on this{' '}
      <a
        href="https://github.com/grafana/grafana/discussions/49253"
        target="_blank"
        rel="noreferrer"
        className="text-link"
      >
        GitHub discussion
      </a>
      .
    </p>
  </>
);
