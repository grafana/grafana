import { ComponentMeta, ComponentStory } from '@storybook/react';
import React from 'react';

import { TypeaheadInput } from '../../types';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';

import { QueryField, QueryFieldProps } from './QueryField';

const meta: ComponentMeta<typeof QueryField> = {
  title: 'Data Source/QueryField',
  component: QueryField,
  decorators: [withCenteredStory],
  parameters: {
    controls: {
      exclude: [
        'onTypeahead',
        'onChange',
        'onBlur',
        'onClick',
        'onRunQuery',
        'onRichValueChange',
        'onWillApplySuggestion',
        'portalOrigin',
        'additionalPlugins',
        'cleanText',
        'syntax',
        'syntaxLoaded',
      ],
    },
  },
  argTypes: {
    query: {
      control: 'text',
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
