import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { SelectBaseProps } from '@grafana/ui/src/components/Select/types';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';
import React, { FC, useMemo } from 'react';

type Props = Omit<SelectBaseProps<GrafanaAlertStateDecision>, 'options'> & {
  includeNoData: boolean;
};

const options: SelectableValue[] = [
  { value: GrafanaAlertStateDecision.Alerting, label: 'Alerting' },
  { value: GrafanaAlertStateDecision.NoData, label: 'No Data' },
  { value: GrafanaAlertStateDecision.OK, label: 'OK' },
];

export const GrafanaAlertStatePicker: FC<Props> = ({ includeNoData, ...props }) => {
  const opts = useMemo(() => {
    if (includeNoData) {
      return options;
    }
    return options.filter((opt) => opt.value !== GrafanaAlertStateDecision.NoData);
  }, [includeNoData]);
  return <Select menuShouldPortal options={opts} {...props} />;
};
