import React from 'react';

import { CalculateFieldHelper } from './CalculateFieldHelper';

interface Helper {
  [key: string]: JSX.Element;
}

const helperContent: Helper = {
  calculateField: CalculateFieldHelper(),
};

// JEV: add logic for no helper content
export const getHelperContent = (id: string): JSX.Element => {
  const defaultMessage = (
    <>
      Go the{' '}
      <a
        href="https://grafana.com/docs/grafana/latest/panels/transformations/?utm_source=grafana"
        target="_blank"
        rel="noreferrer"
      >
        transformation documentation
      </a>{' '}
      for more.
    </>
  );

  if (!(id in helperContent)) {
    return defaultMessage;
  }

  return helperContent[id];
};
