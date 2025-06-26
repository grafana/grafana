import type { Meta, StoryObj } from '@storybook/react';

import { defaultDecorators } from '../../../../../tests/story-utils';

import { ContactPointSelector } from './ContactPointSelector';
import mdx from './ContactPointSelector.mdx';
import { simpleContactPointsListScenario, withErrorScenario } from './ContactPointSelector.test.scenario';

const meta: Meta<typeof ContactPointSelector> = {
  component: ContactPointSelector,
  title: 'zzz_ContactPointSelector',
  decorators: defaultDecorators,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export default meta;
type Story = StoryObj<typeof ContactPointSelector>;

export const Basic: Story = {
  parameters: {
    msw: {
      handlers: simpleContactPointsListScenario,
    },
  },
};

export const WithError: Story = {
  parameters: {
    msw: {
      handlers: withErrorScenario,
    },
  },
};
