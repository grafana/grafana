import { Step } from 'app/features/tutorial/types';

export const goToMenuStep: Step = {
  target: `[data-testid="data-testid Toggle menu"]`,
  title: `Open the menu`,
  content: `This is where you navigate to different parts of Grafana. You can also pin this menu to the side of the screen.`,
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
