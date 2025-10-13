import { Meta, StoryFn } from '@storybook/react';

import { TypeaheadInput } from '../../types';

import { QueryField, QueryFieldProps } from './QueryField';

const meta: Meta<typeof QueryField> = {
  title: 'Data Source/QueryField',
  component: QueryField,
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

export const Basic: StoryFn<typeof QueryField> = (args: Omit<QueryFieldProps, 'theme'>) => <QueryField {...args} />;

Basic.args = {
  onTypeahead: async (_input: TypeaheadInput) => ({
    suggestions: [],
  }),
  query: 'Query text',
  placeholder: 'Placeholder text',
  disabled: false,
};

export default meta;
