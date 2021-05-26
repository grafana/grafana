import React from 'react';
import { action } from '@storybook/addon-actions';
import { Input } from '../Input/Input';
import { Select } from '../Select/Select';
import { InlineField } from './InlineField';
import mdx from './InlineField.mdx';

export default {
  title: 'Forms/InlineField',
  component: InlineField,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const basic = () => {
  return (
    <InlineField label="Inline field">
      <Input placeholder="Inline input" />
    </InlineField>
  );
};

export const withTooltip = () => {
  return (
    <InlineField label="Label" tooltip="Tooltip">
      <Input placeholder="Inline input" />
    </InlineField>
  );
};

export const grow = () => {
  return (
    <InlineField label="Label" grow>
      <Input placeholder="Inline input" />
    </InlineField>
  );
};

export const withSelect = () => {
  return (
    <InlineField label="Select option">
      <Select
        width={16}
        onChange={action('item selected')}
        options={[
          { value: 1, label: 'One' },
          { value: 2, label: 'Two' },
        ]}
      />
    </InlineField>
  );
};

export const multiple = () => {
  return (
    <>
      <InlineField label="Field 1">
        <Input placeholder="Inline input" />
      </InlineField>
      <InlineField label="Field 2">
        <Input placeholder="Inline input" />
      </InlineField>
      <InlineField label="Field 3">
        <Input placeholder="Inline input" />
      </InlineField>
    </>
  );
};
