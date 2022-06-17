import React, { FC, useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { SelectBaseProps } from '@grafana/ui/src/components/Select/types';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

type Props = Omit<SelectBaseProps<GrafanaAlertStateDecision>, 'options'> & {
  includeNoData: boolean;
  includeError: boolean;
};

const options: SelectableValue[] = [
  { value: GrafanaAlertStateDecision.Alerting, label: 'Alerting' },
  { value: GrafanaAlertStateDecision.NoData, label: 'No Data' },
  { value: GrafanaAlertStateDecision.OK, label: 'OK' },
  { value: GrafanaAlertStateDecision.Error, label: 'Error' },
];

export const GrafanaAlertStatePicker: FC<Props> = ({ includeNoData, includeError, ...props }) => {
  const opts = useMemo(() => {
    if (!includeNoData) {
      return options.filter((opt) => opt.value !== GrafanaAlertStateDecision.NoData);
    }
    if (!includeError) {
      return options.filter((opt) => opt.value !== GrafanaAlertStateDecision.Error);
    }
    return options;
  }, [includeNoData, includeError]);
  return <Select options={opts} {...props} />;
};
