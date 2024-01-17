import { useId } from '@react-aria/utils';
import React, { ChangeEvent, PropsWithChildren, ReactElement } from 'react';

import { Checkbox } from '@grafana/ui';

interface VariableCheckboxFieldProps extends React.HTMLAttributes<HTMLInputElement> {
  value: boolean;
  name: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  description?: string;
  ariaLabel?: string;
  testId?: string;
}

export function VariableCheckboxField({
  value,
  name,
  description,
  onChange,
  ariaLabel,
  testId,
}: PropsWithChildren<VariableCheckboxFieldProps>): ReactElement {
  const uniqueId = useId();

  return (
    <Checkbox
      id={uniqueId}
      label={name}
      description={description}
      value={value}
      onChange={onChange}
      aria-label={ariaLabel}
      data-testid={testId}
    />
  );
}
