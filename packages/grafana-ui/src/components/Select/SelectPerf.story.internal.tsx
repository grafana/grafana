import { Meta } from '@storybook/react';
import React from 'react';
import { createFilter } from 'react-select';

import { SelectableValue } from '@grafana/data';

import { withCenteredStory, withHorizontallyCenteredStory } from '../../utils/storybook/withCenteredStory';

import { Select, VirtualizedSelect } from './Select';

const meta: Meta = {
  title: 'Forms/Select (Perf)',
  decorators: [withCenteredStory, withHorizontallyCenteredStory],
};

export default meta;

const lotsOfItems: SelectableValue[] = [];
const ALPHABET = 'qwertyuiopasdfghjklzxcvbnm'.split('');

for (let index = 0; index < 10000; index++) {
  const letter = ALPHABET[index % ALPHABET.length];
  lotsOfItems.push({ label: letter + '-' + index, value: letter + '-' + index });
}

export function SelectThousands() {
  return (
    <div>
      Virtual:
      <VirtualizedSelect options={lotsOfItems} onChange={() => {}} />
      Virtual with ignoreAccents false:
      <VirtualizedSelect filterOption={createFilter({ ignoreAccents: false })} options={lotsOfItems} onChange={() => {}} />
      Normal:
      <Select options={lotsOfItems} onChange={() => {}} />
    </div>
  );
}
