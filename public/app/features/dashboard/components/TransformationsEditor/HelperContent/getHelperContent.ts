import { ReactElement } from 'react';

import { CalculateFieldHelper } from './CalculateFieldHelper';

interface HelperContent {
  title: string;
  // JEV: should this be FC?
  content: ReactElement;
}

interface Helper {
  [key: string]: HelperContent;
}

const helperContent: Helper = {
  calculateField: {
    title: 'Calculate field',
    content: CalculateFieldHelper(),
  },
};

export const getHelperContent = (id: string): HelperContent => helperContent[id];
