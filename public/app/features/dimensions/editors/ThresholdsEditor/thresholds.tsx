import { memo } from 'react';

import { StandardEditorProps, ThresholdsConfig, ThresholdsMode, ThresholdsFieldConfigSettings } from '@grafana/data';

import { ThresholdsEditor } from './ThresholdsEditor';

type Props = StandardEditorProps<ThresholdsConfig, ThresholdsFieldConfigSettings>;

export const ThresholdsValueEditor = memo(({ value, onChange }: Props) => {
  const thresholdsValue = value ?? {
    mode: ThresholdsMode.Percentage,

    // Must be sorted by 'value', first value is always -Infinity
    steps: [
      // anything?
    ],
  };

  return <ThresholdsEditor thresholds={thresholdsValue} onChange={onChange} />;
});

ThresholdsValueEditor.displayName = 'ThresholdsValueEditor';
