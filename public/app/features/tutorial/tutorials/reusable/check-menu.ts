import { Step } from '../../types';

export const checkMenuStep: Step = {
  target: `[data-testid="data-testid Toggle menu"]`,
  title: `Open the menu`,
  content: `Click the menu button to open the menu (remember you can dock it for easier access).`,
  placement: `right`,
  requiredActions: [
    {
      target: `[data-testid="data-testid Toggle menu"]`,
      action: 'click',
    },
  ],
  skipConditions: [
    {
      target: `[data-testid="data-testid navigation mega-menu"]`,
      condition: 'visible',
    },
  ],
};
