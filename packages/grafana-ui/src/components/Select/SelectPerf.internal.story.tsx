import { Meta } from '@storybook/react';
import { fireEvent, getAllByRole } from '@testing-library/dom';
import { useMemo } from 'react';
import ReactSelect, { createFilter } from 'react-select';
import { InteractionTaskArgs, PublicInteractionTask, withPerformance } from 'storybook-addon-performance';

import { SelectableValue } from '@grafana/data';

import { Label } from '../Forms/Label';

import { Select, VirtualizedSelect } from './Select';

const interactionTasks: PublicInteractionTask[] = [
  {
    name: 'Search and select an option',
    description: 'Enter search string and select the first alternative',
    run: async ({ container }: InteractionTaskArgs): Promise<void> => {
      const select = getAllByRole(container, 'combobox')[2];
      select.focus();
      fireEvent.change(select, { target: { value: '400' } });
      fireEvent.keyDown(select, { key: 'Enter', code: 'Enter', charCode: 13 });
    },
  },
];

const meta: Meta = {
  title: 'Forms/Select (Perf)',
  argTypes: {
    numberOfOptions: {
      defaultValue: 10_000,
      control: { type: 'number' },
    },
  },
  decorators: [withPerformance],
  parameters: {
    performance: {
      interactions: interactionTasks,
    },
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
