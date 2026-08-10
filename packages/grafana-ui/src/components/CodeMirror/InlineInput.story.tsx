import type { Meta, StoryFn } from '@storybook/react';
import { useEffect, useState } from 'react';
import { action } from 'storybook/actions';

import { VariableOrigin, type VariableSuggestion } from '@grafana/data';

import { Field } from '../Forms/Field';

import { CodeMirrorInlineInput } from './InlineInput';
import mdx from './InlineInput.mdx';
import { createVariableCompletionSource } from './variableCompletion';

const suggestions: VariableSuggestion[] = [
  { value: '__series.name', label: '__series.name', origin: VariableOrigin.Series },
  { value: '__field.name', label: '__field.name', origin: VariableOrigin.Field },
  { value: '__value.raw', label: '__value.raw', origin: VariableOrigin.Value },
];

// Suggests `${...}` variables when the user types `$`. The factory owns the
// trigger, the filtering and the replaced range, so accepting an option can't
// leave a stray brace behind.
const variableCompletionSource = createVariableCompletionSource(suggestions);

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
  // Carries a complete reference, so the mid-reference case is reachable: put
  // the caret inside `${__value.raw}` and accept an option.
  value: 'https://example.com/d/abc?var=${__value.raw}',
  placeholder: 'http://your-grafana.com/d/000000010/annotations',
  completionSources: [variableCompletionSource],
};

export default meta;
