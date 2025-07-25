import { Meta } from '@storybook/react';
import { useMemo } from 'react';
import ReactSelect, { createFilter } from 'react-select';

import { SelectableValue } from '@grafana/data';

import { Label } from '../Forms/Label';

import { Select, VirtualizedSelect } from './Select';

const meta: Meta = {
  title: 'Developers/Select Perf',
  argTypes: {
    numberOfOptions: {
      defaultValue: 10_000,
      control: { type: 'number' },
    },
  },
  parameters: {
    // TODO fix a11y issue in story and remove this
    a11y: { test: 'off' },
  },
};

export default meta;

const _customFilter = createFilter({ ignoreAccents: false });
function customFilter(opt: SelectableValue, searchQuery: string) {
  return _customFilter(
    {
      label: opt.label ?? '',
      value: opt.value ?? '',
      data: {},
    },
    searchQuery
  );
}

export function PerformanceScenarios({ numberOfOptions }: { numberOfOptions: number }) {
  const options = useMemo(() => {
    const opts: SelectableValue[] = [];
    const ALPHABET = 'qwertyuiopasdfghjklzxcvbnm'.split('');

    for (let index = 0; index < numberOfOptions; index++) {
      const letter = ALPHABET[index % ALPHABET.length];
      opts.push({ label: letter + '-' + index, value: letter + '-' + index });
    }

    return opts;
  }, [numberOfOptions]);

  return (
    <div>
      <Label>Virtual:</Label>
      <VirtualizedSelect options={options} onChange={() => {}} />
      <br />

      <Label>Virtual with ignoreAccents false:</Label>
      <VirtualizedSelect filterOption={customFilter} options={options} onChange={() => {}} />
      <br />

      <Label>Normal:</Label>
      <Select options={options} onChange={() => {}} />
      <br />

      <Label>Standard react-select</Label>
      <ReactSelect options={options} onChange={() => {}} />
      <br />

      <p>Rendered with {options.length.toLocaleString()} options</p>
    </div>
  );
}
