import { InlineField } from '@grafana/ui';
import React from 'react';
import { Props as InlineFieldProps } from '@grafana/ui/src/components/Forms/InlineField';
import { css } from 'emotion';

const DEFAULT_LABEL_WIDTH = 18;

interface FieldProps extends InlineFieldProps {}

export const Field = (props: FieldProps) => {
  const { children, ...rest } = props;

  return (
    <InlineField
      className={css`
         {
          align-items: center;
        }
      `}
      labelWidth={DEFAULT_LABEL_WIDTH}
      {...rest}
    >
      {children}
    </InlineField>
  );
};

export const MultipleFields = (props: FieldProps) => {
  const { children, ...rest } = props;

  return (
    <InlineField
      className={css`
         {
          align-items: stretch;
        }
      `}
      labelWidth={DEFAULT_LABEL_WIDTH}
      {...rest}
    >
      {children}
    </InlineField>
  );
};
