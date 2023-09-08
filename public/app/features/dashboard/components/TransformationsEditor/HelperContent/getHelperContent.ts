import { CalculateFieldHelper } from './CalculateFieldHelper';

interface Helper {
  [key: string]: JSX.Element;
}

const helperContent: Helper = {
  calculateField: CalculateFieldHelper(),
};

// JEV: add logic for no helper content
export const getHelperContent = (id: string): JSX.Element => helperContent[id];
