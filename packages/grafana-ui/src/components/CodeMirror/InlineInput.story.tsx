import type { Meta, StoryFn } from '@storybook/react';
import { useEffect, useState } from 'react';
import { action } from 'storybook/actions';

import { Field } from '../Forms/Field';

import { CodeMirrorInlineInput } from './InlineInput';
import mdx from './InlineInput.mdx';
import type { CodeMirrorCompletionSource } from './types';

// A trivial completion source that suggests a couple of `${...}` variables when
// the user types `$`.
const variableCompletionSource: CodeMirrorCompletionSource = (context) => {
  const word = context.matchBefore(/\$\{?[\w.]*$/);
  if (!word && !context.explicit) {
    return null;
  }

  return {
    from: word ? word.from : context.pos,
    filter: false,
    options: [
      { label: '__series.name', apply: '${__series.name}', type: 'variable' },
      { label: '__field.name', apply: '${__field.name}', type: 'variable' },
      { label: '__value.raw', apply: '${__value.raw}', type: 'variable' },
    ],
  };
};

const meta: Meta<typeof CodeMirrorInlineInput> = {
  title: 'Inputs/CodeMirrorInlineInput',
  component: CodeMirrorInlineInput,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onChange', 'completionSources', 'extensions', 'id'],
    },
  },
  argTypes: {
    placeholder: {
      control: 'text',
      description: 'Placeholder shown when the input is empty.',
    },
  },
};

const Controlled: StoryFn<typeof CodeMirrorInlineInput> = (args) => {
  const [value, setValue] = useState(args.value);

  useEffect(() => {
    setValue(args.value);
  }, [args.value]);

  return (
    <Field label="URL">
      <CodeMirrorInlineInput
        {...args}
        value={value}
        aria-label={args['aria-label'] ?? 'Inline input'}
        onChange={(nextValue) => {
          setValue(nextValue);
          action('onChange')(nextValue);
        }}
      />
    </Field>
  );
};

export const Basic = Controlled.bind({});
Basic.args = {
  value: '',
  placeholder: 'http://your-grafana.com/d/000000010/annotations',
};

export const LongValue = Controlled.bind({});
LongValue.args = {
  value:
    'https://your-grafana.com/d/000000010/some-very-long-dashboard-slug?var-country=${__data.fields.CountryCode}&var-region=${__data.fields.Region}&from=now-6h&to=now',
  placeholder: 'http://your-grafana.com/d/000000010/annotations',
};

export const WithVariableCompletions = Controlled.bind({});
WithVariableCompletions.args = {
  value: 'https://example.com/d/abc?var=',
  placeholder: 'http://your-grafana.com/d/000000010/annotations',
  completionSources: [variableCompletionSource],
};

export default meta;
