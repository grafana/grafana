import type { Step, Tutorial } from '../types';

const info = {
  id: 'changing-password',
  name: 'How to change your password',
  description: `This is a tutorial that shows you where to locate your user icon and how to change your password.`,
  tags: {
    area: `Core`,
    type: `Interactive`,
  },
  author: `Grafana Labs`,
};

const tutorialSteps: Step[] = [
  {
    target: `[aria-label='Profile']`,
    title: `This is your profile icon`,
    content: `Click on it to open the user menu.`,
    placement: `left`,
    requiredActions: [
      {
        action: `click`,
        target: `[aria-label='Profile']`,
      },
    ],
  },
  {
    target: `[href='/profile/password']`,
    title: `Click on 'Change password'`,
    content: `This will take you to the page where you can change your password.`,
    placement: `left`,
    requiredActions: [
      {
        action: `click`,
        target: `[href='/profile/password']`,
      },
    ],
  },
  {
    target: `form`,
    title: `Change password form`,
    content: `
    This is the form where you can change your password. Enter your current password and your new password. You'll have to rewrite your new password to confirm it.`,
    placement: `right`,
    requiredActions: [
      {
        target: `[id='current-password']`,
        action: `input`,
        regEx: `/^(?!s*$).+/`,
      },
      {
        target: `[id='new-password']`,
        action: `input`,
        regEx: `/^(?!s*$).+/`,
      },
      {
        target: `[id='confirm-new-password']`,
        action: `input`,
        regEx: `/^(?!s*$).+/`,
      },
    ],
  },
  {
    target: `form [type='submit']`,
    title: `Submit the form`,
    content: `All that's left to do is to click on the 'Change Password' button and your password will be changed.`,
    placement: `right`,
  },
];

export const changingPasswordTutorial: Tutorial = {
  ...info,
  steps: tutorialSteps,
};
