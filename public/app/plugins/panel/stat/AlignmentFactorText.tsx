import React, { useCallback } from 'react';
import { Input } from '@grafana/ui';
import { css } from 'emotion';
import { config } from 'app/core/config';

interface Props {
  value?: string;
  onChange: (value?: string) => void;
}

export const AlignmentFactorTextEditor: React.FC<Props> = ({ value, onChange }) => {
  const styles = {
    textInput: css`
      margin-bottom: 5px;
      &:hover {
        border: 1px solid ${config.theme.colors.formInputBorderHover};
      }
    `,
  };

  const onValueChange = useCallback(
    (e: React.SyntheticEvent) => {
      const evt = e as React.FormEvent<HTMLInputElement>;
      const raw = evt.currentTarget.value.trim();
      const val = raw === '' ? undefined : raw;
      if (e.hasOwnProperty('key')) {
        // handling keyboard event
        if ((evt as any).key === 'Enter') {
          onChange(val);
        }
      } else {
        // handling form event
        onChange(val);
      }
    },
    [onChange]
  );

  const suffix = <div>{value ? `${value.length}` : 'empty'}</div>;

  return (
    <Input
      className={styles.textInput}
      defaultValue={value || ''}
      onBlur={onValueChange}
      onKeyDown={onValueChange}
      suffix={suffix}
    />
  );
};
