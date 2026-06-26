import { type Meta, type StoryFn } from '@storybook/react-webpack5';
import { useId, useState } from 'react';

import { type TypeaheadInput, type TypeaheadOutput } from '../../types/completion';
import { Field } from '../Forms/Field';
import { Label } from '../Forms/Label';

import { QueryField, type QueryFieldProps } from './QueryField';

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

// A static set of suggestions to mimic what a real datasource would return from onTypeahead.
// The SuggestionsPlugin filters and sorts these based on what's typed before rendering the Typeahead.
const FUNCTIONS = ['rate', 'sum', 'avg', 'min', 'max', 'count', 'histogram_quantile', 'increase', 'irate'];
const METRICS = [
  'go_goroutines',
  'go_memstats_alloc_bytes',
  'http_request_duration_seconds',
  'http_requests_total',
  'process_cpu_seconds_total',
  'up',
];

// Exercises the full SuggestionsPlugin -> Typeahead path: typing in the field calls onTypeahead,
// and a non-empty `suggestions` result opens the Typeahead portal anchored to the caret.
// Use it to manually verify suggestions render, keyboard navigation (Arrow/Enter/Tab/Escape) works,
// and the portal is created and torn down cleanly when the field mounts/unmounts.
export const WithSuggestions: StoryFn<typeof QueryField> = (args: Omit<QueryFieldProps, 'theme'>) => {
  const id = useId();
  const [show, setShow] = useState(false);

  return (
    <>
      <button onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'} QueryField</button>
      {!show && (
        <Field
          label={<Label id={id}>Type to see suggestions (e.g. &quot;ra&quot;, &quot;http&quot;, &quot;go&quot;)</Label>}
        >
          <QueryField {...args} aria-labelledby={id} />
        </Field>
      )}
    </>
  );
};

WithSuggestions.args = {
  onTypeahead: async (_input: TypeaheadInput): Promise<TypeaheadOutput> => ({
    suggestions: [
      {
        label: 'Functions',
        items: FUNCTIONS.map((label) => ({ label, kind: 'function' })),
      },
      {
        label: 'Metrics',
        items: METRICS.map((label) => ({ label })),
      },
    ],
  }),
  query: '',
  placeholder: 'Start typing to trigger the typeahead…',
  disabled: false,
};

export default meta;
