import * as React from 'react';

import { InlineFieldRow, InlineField } from '@grafana/ui';

interface Props {
  label: string;
  tooltip?: string;
  children: React.ReactElement;
}
const SearchField = ({ label, tooltip, children }: Props) => {
  return (
    <InlineFieldRow>
      <InlineField label={label} labelWidth={28} grow tooltip={tooltip}>
        {children}
      </InlineField>
    </InlineFieldRow>
  );
};

export default SearchField;
