import React from 'react';

import { Field, MultiSelect, useStyles2 } from '@grafana/ui';
import { useMuteTimingOptions } from 'app/features/alerting/unified/hooks/useMuteTimingOptions';
import { mapMultiSelectValueToStrings, stringsToSelectableValues } from 'app/features/alerting/unified/utils/amroutes';

import { getFormStyles } from '../../../notification-policies/formStyles';

interface MuteTimingFieldsProps {
  onChange: (value: string[]) => void;
  muteTimmings: string[];
}

export function MuteTimingFields({ onChange, muteTimmings }: MuteTimingFieldsProps) {
  const styles = useStyles2(getFormStyles);

  const muteTimingOptions = useMuteTimingOptions();
  return (
    <Field
      data-testid="am-mute-timing-select"
      description="Select a mute timing to define when not to send notification for this alert rule"
      label="Mute timings"
    >
      <MultiSelect
        aria-label="Mute timings"
        className={styles.input}
        onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
        options={muteTimingOptions}
        value={stringsToSelectableValues(muteTimmings)}
      />
    </Field>
  );
}
