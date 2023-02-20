import React, { FC } from 'react';

import { InlineFieldRow, InlineField } from '@grafana/ui';

interface Props {
  label: string;
  children: React.ReactElement;
}
const SearchField: FC<Props> = ({ label, children }) => {
  return (
    <InlineFieldRow>
      <InlineField label={label} labelWidth={14} grow>
        {children}
      </InlineField>
    </InlineFieldRow>
  );
};

export default SearchField;
