import { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select, SelectBaseProps } from '@grafana/ui';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';

type Props = Omit<SelectBaseProps<GrafanaAlertStateDecision>, 'options'> & {
  includeNoData: boolean;
  includeError: boolean;
};

const options: SelectableValue[] = [
  { value: GrafanaAlertStateDecision.Alerting, label: 'Alerting' },
  { value: GrafanaAlertStateDecision.NoData, label: 'No Data' },
  { value: GrafanaAlertStateDecision.OK, label: 'Normal' },
  { value: GrafanaAlertStateDecision.Error, label: 'Error' },
  { value: GrafanaAlertStateDecision.KeepLast, label: 'Keep Last State' },
];

export const GrafanaAlertStatePicker = ({ includeNoData, includeError, ...props }: Props) => {
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
