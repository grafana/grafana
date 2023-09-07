import { ReactElement } from 'react';

import { CalculateFieldHelper } from './CalculateFieldHelper';

interface HelperContent {
  title: string;
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
