import React from 'react';
import { useFormContext } from 'react-hook-form';

import { SelectableValue } from '@grafana/data';
import { Field, InputControl, MultiSelect, useStyles2 } from '@grafana/ui';
import { alertmanagerApi } from 'app/features/alerting/unified/api/alertmanagerApi';
import { RuleFormValues } from 'app/features/alerting/unified/types/rule-form';
import { timeIntervalToString } from 'app/features/alerting/unified/utils/alertmanager';
import { mapMultiSelectValueToStrings } from 'app/features/alerting/unified/utils/amroutes';

import { getFormStyles } from '../../../../notification-policies/formStyles';

export interface MuteTimingFieldsProps {
  alertManager: string;
}

export function MuteTimingFields({ alertManager }: MuteTimingFieldsProps) {
  const styles = useStyles2(getFormStyles);
  const {
    control,
    formState: { errors },
  } = useFormContext<RuleFormValues>();

  const muteTimingOptions = useSelectableMuteTimings();
  return (
    <Field
      label="Mute timings"
      data-testid="am-mute-timing-select"
      description="Select a mute timing to define when not to send notifications for this alert rule"
      invalid={!!errors.contactPoints?.[alertManager]?.muteTimeIntervals}
    >
      <InputControl
        render={({ field: { onChange, ref, ...field } }) => (
          <MultiSelect
            aria-label="Mute timings"
            {...field}
            className={styles.input}
            onChange={(value) => onChange(mapMultiSelectValueToStrings(value))}
            options={muteTimingOptions}
            placeholder="Select mute timings..."
          />
        )}
        control={control}
        name={`contactPoints.${alertManager}.muteTimeIntervals`}
      />
    </Field>
  );
}

function useSelectableMuteTimings(): Array<SelectableValue<string>> {
  const fetchGrafanaMuteTimings = alertmanagerApi.endpoints.getMuteTimingList.useQuery(undefined, {
    refetchOnFocus: true,
    refetchOnReconnect: true,
    selectFromResult: (result) => ({
      ...result,
      mutetimings: result.data
        ? result.data.map((value) => ({
            value: value.name,
            label: value.name,
            description: value.time_intervals.map((interval) => timeIntervalToString(interval)).join(', AND '),
          }))
        : [],
    }),
  });
  return fetchGrafanaMuteTimings.mutetimings;
}
