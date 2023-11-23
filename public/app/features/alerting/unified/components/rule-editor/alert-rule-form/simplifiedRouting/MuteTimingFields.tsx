import React from 'react';

import { Field, MultiSelect, useStyles2 } from '@grafana/ui';
import { useAlertmanagerConfig } from 'app/features/alerting/unified/hooks/useAlertmanagerConfig';
import { mapMultiSelectValueToStrings } from 'app/features/alerting/unified/utils/amroutes';

import { getFormStyles } from '../../../notification-policies/formStyles';

interface MuteTimingFieldsProps {
  alertManager: string;
  onChange: (value: string[]) => void;
}

function useMuteTimingOptions(alertmanager: string) {
  const { currentData: result } = useAlertmanagerConfig(alertmanager); //is this necessary? maybe we already have this config in the parent
  const config = result?.alertmanager_config;
  const muteTimingOptions = config?.mute_time_intervals?.map((mti) => ({
    label: mti.name,
    value: mti.name,
  }));
  return muteTimingOptions ?? [];
}

export function MuteTimingFields({ alertManager, onChange }: MuteTimingFieldsProps) {
  const styles = useStyles2(getFormStyles);

  const muteTimingOptions = useMuteTimingOptions(alertManager);
  return (
    <Field data-testid="am-mute-timing-select" description="Add mute timing to policy">
      <MultiSelect
        aria-label="Mute timings"
        className={styles.input}
        onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
        options={muteTimingOptions}
      />
    </Field>
  );
}
