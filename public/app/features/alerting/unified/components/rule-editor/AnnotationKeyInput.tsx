import { SelectableValue } from '@grafana/data';
import { Input, Select } from '@grafana/ui';
import React, { FC, useMemo, useState } from 'react';

enum AnnotationOptions {
  description = 'Description',
  dashboard = 'Dashboard',
  summary = 'Summary',
  runbook = 'Runbook URL',
}

interface Props {
  onChange: (value: string) => void;
  existingKeys: string[];

  value?: string;
  width?: number;
  className?: string;
}

export const AnnotationKeyInput: FC<Props> = ({ value, onChange, existingKeys, width, className }) => {
  const [isCustom, setIsCustom] = useState(false);

  const annotationOptions = useMemo(
    (): SelectableValue[] => [
      ...Object.entries(AnnotationOptions)
        .filter(([optKey]) => !existingKeys.includes(optKey)) // remove keys already taken in other annotations
        .map(([key, value]) => ({ value: key, label: value })),
      { value: '__add__', label: '+ Custom name' },
    ],
    [existingKeys]
  );

  if (isCustom) {
    return (
      <Input
        width={width}
        autoFocus={true}
        value={value || ''}
        placeholder="key"
        className={className}
        onChange={(e) => onChange((e.target as HTMLInputElement).value)}
      />
    );
  } else {
    return (
      <Select
        width={width}
        options={annotationOptions}
        value={value}
        className={className}
        onChange={(val: SelectableValue) => {
          const value = val?.value;
          if (value === '__add__') {
            setIsCustom(true);
          } else {
            onChange(value);
          }
        }}
      />
    );
  }
};
