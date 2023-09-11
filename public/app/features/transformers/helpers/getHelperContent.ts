// import React from 'react';

import { CalculateFieldHelper } from './CalculateFieldHelper';
import { ConcatenateHelper } from './ConcatenateHelper';

interface Helper {
  [key: string]: JSX.Element;
}

const helperContent: Helper = {
  calculateField: CalculateFieldHelper(),
  concatenate: ConcatenateHelper(),
};

// JEV: add logic for no helper content
export function getHelperContent(id: string): JSX.Element | string {
  const defaultMessage = 'u broke it, u buy it';

  if (id in helperContent) {
    return helperContent[id];
  }

  return defaultMessage;
}
