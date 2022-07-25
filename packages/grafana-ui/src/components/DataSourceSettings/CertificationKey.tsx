import React, { ChangeEvent, MouseEvent, FC } from 'react';

import { Button } from '../Button';
import { InlineField } from '../Forms/InlineField';
import { InlineFieldRow } from '../Forms/InlineFieldRow';
import { Input } from '../Input/Input';
import { TextArea } from '../TextArea/TextArea';

interface Props {
  label: string;
  hasCert: boolean;
  placeholder: string;

  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export const CertificationKey: FC<Props> = ({ hasCert, label, onChange, onClick, placeholder }) => {
  return (
    <InlineFieldRow>
      <InlineField label={label} labelWidth={14} disabled={hasCert}>
        {hasCert ? (
          <Input type="text" value="configured" width={24} />
        ) : (
          <TextArea rows={7} onChange={onChange} placeholder={placeholder} required />
        )}
      </InlineField>
      {hasCert && (
        <Button variant="secondary" onClick={onClick} style={{ marginLeft: 4 }}>
          Reset
        </Button>
      )}
    </InlineFieldRow>
  );
};
