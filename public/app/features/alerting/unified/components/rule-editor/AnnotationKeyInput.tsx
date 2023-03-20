import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';

import { Annotation, annotationLabels } from '../../utils/constants';

import { SelectWithAdd } from './SelectWIthAdd';

interface Props {
  onChange: (value: string) => void;
  existingKeys: string[];

  value?: string;
  width?: number;
  className?: string;
  'aria-label'?: string;
}

export const AnnotationKeyInput = ({ value, existingKeys, 'aria-label': ariaLabel, ...rest }: Props) => {
  const annotationOptions = useMemo(
    (): SelectableValue[] =>
      Object.values(Annotation)
        .filter((key) => !existingKeys.includes(key)) // remove keys already taken in other annotations
        .map((key) => ({ value: key, label: annotationLabels[key] })),
    [existingKeys]
  );

  return (
    <SelectWithAdd
      aria-label={ariaLabel}
      value={value}
      options={annotationOptions}
      custom={!!value && !(Object.values(Annotation) as string[]).includes(value)}
      {...rest}
    />
  );
};
