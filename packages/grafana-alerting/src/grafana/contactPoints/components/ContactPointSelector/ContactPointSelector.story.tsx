import type { Meta, StoryObj } from '@storybook/react';

import { getDefaultWrapper } from '../../../../../tests/provider';

import { ContactPointSelector } from './ContactPointSelector';
import mdx from './ContactPointSelector.mdx';
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
