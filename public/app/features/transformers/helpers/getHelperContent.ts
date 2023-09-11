// import React from 'react';

import { CalculateFieldHelper } from './CalculateFieldHelper';

interface Helper {
  [key: string]: JSX.Element;
}

const helperContent: Helper = {
  calculateField: CalculateFieldHelper(),
};

// JEV: add logic for no helper content
export function getHelperContent(id: string): JSX.Element | string {
  const defaultMessage = 'u broke it, u buy it';

  if (id in helperContent) {
    return helperContent[id];
  }

  return defaultMessage;
}
