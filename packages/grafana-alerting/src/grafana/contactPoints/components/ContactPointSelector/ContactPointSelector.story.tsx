import type { Meta, StoryObj } from '@storybook/react';

import { getDefaultWrapper } from '../../../../../tests/provider';

import { ContactPointSelector } from './ContactPointSelector';
import { simpleContactPointsListScenario, withErrorScenario } from './ContactPointSelector.test.scenario';

const Wrapper = getDefaultWrapper();

const decorators: Meta['decorators'] = [
  (Story) => (
    <Wrapper>
      <Story />
    </Wrapper>
  ),
];

const meta: Meta<typeof ContactPointSelector> = {
  component: ContactPointSelector,
  title: 'ContactPointSelector',
  decorators,
};

export default meta;
type Story = StoryObj<typeof ContactPointSelector>;

export const Basic: Story = {
  args: {
    onChange: () => {},
  },
  parameters: {
    msw: {
      handlers: simpleContactPointsListScenario,
    },
  },
};

export const WithError: Story = {
  args: {
    onChange: () => {},
  },
  parameters: {
    msw: {
      handlers: withErrorScenario,
    },
  },
};
