import React, { FC } from 'react';

import { InlineFieldRow, InlineField } from '@grafana/ui';

interface Props {
  label: string;
  tooltip?: string;
  children: React.ReactElement;
}
const SearchField: FC<Props> = ({ label, tooltip, children }) => {
  return (
    <InlineFieldRow>
      <InlineField label={label} labelWidth={16} grow tooltip={tooltip}>
        {children}
      </InlineField>
    </InlineFieldRow>
  );
};

export default SearchField;
