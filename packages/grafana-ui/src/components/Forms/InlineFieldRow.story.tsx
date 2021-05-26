import React from 'react';
import { InlineFieldRow } from './InlineFieldRow';
import mdx from './InlineFieldRow.mdx';
import { InlineField } from './InlineField';
import { Input } from '../Input/Input';

export default {
  title: 'Forms/InlineFieldRow',
  component: InlineFieldRow,
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

export const single = () => {
  return (
    <div style={{ width: '100%' }}>
      <InlineFieldRow>
        <InlineField label="Label Row 1">
          <Input placeholder="Label" />
        </InlineField>
        <InlineField label="Label Row 1">
          <Input placeholder="Label" />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Label Row 2">
          <Input placeholder="Label" />
        </InlineField>
        <InlineField label="Label Row 2">
          <Input placeholder="Label" />
        </InlineField>
        <InlineField label="Label Row 2 Grow" grow>
          <Input placeholder="Label" />
        </InlineField>
      </InlineFieldRow>
    </div>
  );
};
