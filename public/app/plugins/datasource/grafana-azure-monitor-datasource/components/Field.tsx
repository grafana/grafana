import { InlineField } from '@grafana/ui';
import React from 'react';
import { Props as InlineFieldProps } from '@grafana/ui/src/components/Forms/InlineField';

const DEFAULT_LABEL_WIDTH = 18;

export const Field = (props: InlineFieldProps) => {
  return <InlineField labelWidth={DEFAULT_LABEL_WIDTH} {...props} />;
};
