import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { SelectBaseProps } from '@grafana/ui/src/components/Select/types';
import { GrafanaAlertStateDecision } from 'app/types/unified-alerting-dto';
import React, { FC } from 'react';

type Props = Omit<SelectBaseProps<GrafanaAlertStateDecision>, 'options'>;

const options: SelectableValue[] = [
  { value: GrafanaAlertStateDecision.Alerting, label: 'Alerting' },
  { value: GrafanaAlertStateDecision.NoData, label: 'No Data' },
  { value: GrafanaAlertStateDecision.KeepLastState, label: 'Keep Last State' },
  { value: GrafanaAlertStateDecision.OK, label: 'OK' },
];

export const GrafanaAlertStatePicker: FC<Props> = (props) => <Select options={options} {...props} />;
