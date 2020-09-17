import React from 'react';
import { InlineField } from './InlineField';
import mdx from './InlineField.mdx';
import { Input } from '../Input/Input';

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
