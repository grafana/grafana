import { SelectableValue } from '@grafana/data';
import React, { FC, useMemo } from 'react';
import { SelectWithAdd } from './SelectWIthAdd';

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

export const AnnotationKeyInput: FC<Props> = ({ value, existingKeys, ...rest }) => {
  const annotationOptions = useMemo(
    (): SelectableValue[] =>
      Object.entries(AnnotationOptions)
        .filter(([optKey]) => !existingKeys.includes(optKey)) // remove keys already taken in other annotations
        .map(([key, value]) => ({ value: key, label: value })),
    [existingKeys]
  );

  return (
    <SelectWithAdd
      value={value}
      options={annotationOptions}
      custom={!!value && !Object.keys(AnnotationOptions).includes(value)}
      {...rest}
    />
  );
};
