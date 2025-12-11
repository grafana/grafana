import { Meta, StoryFn } from '@storybook/react';
import { useId } from 'react';

import { TypeaheadInput } from '../../types/completion';
import { Field } from '../Forms/Field';
import { Label } from '../Forms/Label';

import { QueryField, QueryFieldProps } from './QueryField';

const meta: Meta<typeof QueryField> = {
  title: 'Inputs/Deprecated/QueryField',
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

export const Basic: StoryFn<typeof QueryField> = (args: Omit<QueryFieldProps, 'theme'>) => {
  const id = useId();
  // have to manually set an id on the label
  // can't use htmlFor as QueryField is a contenteditable div, not an input
  return (
    <Field label={<Label id={id}>Query field</Label>}>
      <QueryField {...args} aria-labelledby={id} />
    </Field>
  );
};

Basic.args = {
  onTypeahead: async (_input: TypeaheadInput) => ({
    suggestions: [],
  }),
  query: 'Query text',
  placeholder: 'Placeholder text',
  disabled: false,
};

export default meta;
