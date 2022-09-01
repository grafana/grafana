import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { TypeaheadInput } from '../../types';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { QueryField, QueryFieldProps } from './QueryField';

const disabledControl = {
  table: {
    disable: true,
  },
};

const meta: ComponentMeta<typeof QueryField> = {
  title: 'Data Source/QueryField',
  component: QueryField,
  decorators: [withCenteredStory],
  argTypes: {
    onTypeahead: disabledControl,
    onChange: disabledControl,
    onBlur: disabledControl,
    onClick: disabledControl,
    onRunQuery: disabledControl,
    onRichValueChange: disabledControl,
    onWillApplySuggestion: disabledControl,
    portalOrigin: disabledControl,
    additionalPlugins: disabledControl,
    cleanText: disabledControl,
    syntax: disabledControl,
    syntaxLoaded: disabledControl,
    placeholder: {
      control: 'text',
    },
    query: {
      control: 'text',
    },
    disabled: {
      control: 'boolean',
    },
  },
};

export const Basic: ComponentStory<typeof QueryField> = (args: Omit<QueryFieldProps, 'theme'>) => (
  <QueryField {...args} />
);

Basic.args = {
  onTypeahead: async (_input: TypeaheadInput) => ({
    suggestions: [],
  }),
  query: 'Query text',
  placeholder: 'Placeholder text',
  disabled: false,
};

export default meta;
