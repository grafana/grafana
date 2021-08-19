import React, { ChangeEvent, MouseEvent, FC } from 'react';
import { Input } from '../Input/Input';
import { Button } from '../Button';
import { TextArea } from '../TextArea/TextArea';
import { InlineField } from '../Forms/InlineField';

interface Props {
  label: string;
  hasCert: boolean;
  placeholder: string;

  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}

export const CertificationKey: FC<Props> = ({ hasCert, label, onChange, onClick, placeholder }) => {
  return (
    <InlineField label={label} labelWidth={14}>
      {hasCert ? (
        <>
          <Input type="text" disabled value="configured" width={24} />
          <Button variant="secondary" onClick={onClick} style={{ marginLeft: 4 }}>
            Reset
          </Button>
        </>
      ) : (
        <TextArea rows={7} onChange={onChange} placeholder={placeholder} required />
      )}
    </InlineField>
  );
};
