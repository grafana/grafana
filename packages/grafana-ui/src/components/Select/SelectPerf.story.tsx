import { Meta } from '@storybook/react';
import { useId, useMemo } from 'react';
import ReactSelect, { createFilter } from 'react-select';

import { SelectableValue } from '@grafana/data';

import { Field } from '../Forms/Field';

import { Select, VirtualizedSelect } from './Select';

const meta: Meta = {
  title: 'Developers/Select Perf',
  argTypes: {
    numberOfOptions: {
      defaultValue: 10_000,
      control: { type: 'number' },
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
  const virtualId = useId();
  const virtualIgnoreAccentsId = useId();
  const normalId = useId();
  const standardId = useId();
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
      <Field label="Virtual:">
        <VirtualizedSelect inputId={virtualId} options={options} onChange={() => {}} />
      </Field>
      <br />

      <Field label="Virtual with ignoreAccents false:">
        <VirtualizedSelect
          inputId={virtualIgnoreAccentsId}
          filterOption={customFilter}
          options={options}
          onChange={() => {}}
        />
      </Field>
      <br />

      <Field label="Normal:">
        <Select inputId={normalId} options={options} onChange={() => {}} />
      </Field>
      <br />

      <Field label="Standard react-select">
        <ReactSelect inputId={standardId} options={options} onChange={() => {}} />
      </Field>
      <br />

      <p>Rendered with {options.length.toLocaleString()} options</p>
    </div>
  );
}
