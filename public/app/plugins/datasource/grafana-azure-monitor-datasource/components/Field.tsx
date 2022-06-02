import React from 'react';

import { EditorField } from '@grafana/experimental';
import { config } from '@grafana/runtime';
import { InlineField } from '@grafana/ui';
import { Props as InlineFieldProps } from '@grafana/ui/src/components/Forms/InlineField';

interface Props extends InlineFieldProps {
  label: string;
}

const DEFAULT_LABEL_WIDTH = 18;

export const Field = (props: Props) => {
  if (config.featureToggles.azureMonitorExperimentalUI) {
    return <EditorField width={DEFAULT_LABEL_WIDTH} {...props} />;
  }
  return <InlineField labelWidth={DEFAULT_LABEL_WIDTH} {...props} />;
};
