import { SelectableValue } from '@grafana/data';
import React, { FC, useMemo } from 'react';
import { SelectWithAdd } from './SelectWIthAdd';
import { Annotation, annotationLabels } from '../../utils/constants';

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
      Object.values(Annotation)
        .filter((key) => !existingKeys.includes(key)) // remove keys already taken in other annotations
        .map((key) => ({ value: key, label: annotationLabels[key] })),
    [existingKeys]
  );

  return (
    <SelectWithAdd
      value={value}
      options={annotationOptions}
      custom={!!value && !(Object.values(Annotation) as string[]).includes(value)}
      {...rest}
    />
  );
};
