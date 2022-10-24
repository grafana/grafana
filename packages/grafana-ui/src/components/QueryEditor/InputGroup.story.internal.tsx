import { ComponentMeta } from '@storybook/react';
import React from 'react';

import { Stack } from '..';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';

import { AccessoryButton } from './AccessoryButton';
import { InputGroup } from './InputGroup';

const meta: ComponentMeta<typeof InputGroup> = {
  title: 'Experimental/InputGroup',
  component: InputGroup,
  decorators: [withCenteredStory],
};

export function WithTextInputs() {
  return (
    <InputGroup>
      <Input placeholder="One" />
      <Input placeholder="Two" />
    </InputGroup>
  );
}

export function WithAccessoryButton() {
  return (
    <InputGroup>
      <Select value={selectOptions[0]} options={selectOptions} onChange={() => {}} />
      <AccessoryButton aria-label="Remove group by column" icon="times" variant="secondary" />
    </InputGroup>
  );
}

export function WithSelectsAndInput() {
  return (
    <Stack direction="column">
      <InputGroup>
        <Input invalid placeholder="LHS" />
        <Select value={comparitorOptions[0]} options={comparitorOptions} onChange={() => {}} />
        <Input placeholder="RHS" />
      </InputGroup>
      <InputGroup>
        <Input placeholder="LHS" />
        <Select invalid value={comparitorOptions[0]} options={comparitorOptions} onChange={() => {}} />
        <Input placeholder="RHS" />
      </InputGroup>
      <InputGroup>
        <Input placeholder="LHS" />
        <Select value={comparitorOptions[0]} options={comparitorOptions} onChange={() => {}} />
        <Input invalid placeholder="RHS" />
      </InputGroup>
    </Stack>
  );
}

const selectOptions = [{ label: 'Prometheus', value: 1 }];
const comparitorOptions = [
  { label: '=', value: 1 },
  { label: '<', value: 2 },
  { label: '>', value: 3 },
];

export default meta;
