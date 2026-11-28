import { type Meta, type StoryFn } from '@storybook/react';
import { useId } from 'react';
import { action } from 'storybook/actions';
import { useArgs } from 'storybook/preview-api';

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
  const [, updateArgs] = useArgs();
  const labelId = useId();

  return (
    <Field label={<Label id={labelId}>Query</Label>}>
      <QueryInput
        {...args}
        value={args.value}
        aria-labelledby={labelId}
        onChange={(nextValue) => {
          updateArgs({ value: nextValue });
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
