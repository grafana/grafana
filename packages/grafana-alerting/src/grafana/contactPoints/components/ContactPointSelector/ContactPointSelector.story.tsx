import type { Meta, StoryFn, StoryObj } from '@storybook/react';
import { useId } from 'react';

import { Field } from '@grafana/ui';

import { defaultDecorators } from '../../../../../tests/story-utils';

import { ContactPointSelector, ContactPointSelectorProps } from './ContactPointSelector';
import mdx from './ContactPointSelector.mdx';
import { simpleContactPointsListScenario, withErrorScenario } from './ContactPointSelector.test.scenario';

const meta: Meta<typeof ContactPointSelector> = {
  component: ContactPointSelector,
  title: 'Contact Points/ContactPointSelector',
  decorators: defaultDecorators,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const StoryRenderFn: StoryFn<ContactPointSelectorProps> = (args) => {
  const id = useId();
  return (
    <Field noMargin label="Select contact point">
      <ContactPointSelector {...args} id={id} />
    </Field>
  );
};

export default meta;
type Story = StoryObj<typeof ContactPointSelector>;

export const Basic: Story = {
  parameters: {
    msw: {
      handlers: simpleContactPointsListScenario,
    },
  },
  render: StoryRenderFn,
};

export const WithError: Story = {
  parameters: {
    msw: {
      handlers: withErrorScenario,
    },
  },
  render: StoryRenderFn,
};
