import { Meta } from '@storybook/react';
import React from 'react';

import { Input } from '../Input/Input';

import { InlineField } from './InlineField';
import { InlineFieldRow } from './InlineFieldRow';
import mdx from './InlineFieldRow.mdx';

const meta: Meta<typeof InlineFieldRow> = {
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

export default meta;
