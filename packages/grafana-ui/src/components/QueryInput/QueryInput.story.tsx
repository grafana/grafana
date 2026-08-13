import { type Meta, type StoryFn } from '@storybook/react-webpack5';
import { useEffect, useId, useState } from 'react';
import { action } from 'storybook/actions';

import { Field } from '../Forms/Field';
import { Label } from '../Forms/Label';

import { QueryInput } from './QueryInput';
import mdx from './QueryInput.mdx';

const meta: Meta<typeof QueryInput> = {
  title: 'Inputs/QueryInput',
  component: QueryInput,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onChange', 'onBlur', 'onRunQuery'],
    },
  },
  argTypes: {
    value: {
      control: 'text',
    },
  },
};

export const Basic: StoryFn<typeof QueryInput> = (args) => {
  const [value, setValue] = useState(args.value);
  const labelId = useId();

  useEffect(() => {
    setValue(args.value);
  }, [args.value]);

  return (
    <Field label={<Label id={labelId}>Query</Label>}>
      <QueryInput
        {...args}
        value={value}
        aria-labelledby={labelId}
        onChange={(nextValue) => {
          setValue(nextValue);
          action('onChange')(nextValue);
        }}
        onRunQuery={action('onRunQuery')}
        onBlur={action('onBlur')}
      />
    </Field>
  );
};

Basic.args = {
  value: 'app.requests.count',
  placeholder: 'Enter a query (run with Shift+Enter)',
};

export default meta;
