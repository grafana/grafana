import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import { SelectBaseProps } from '@grafana/ui/src/components/Select/types';
import { GrafanaAlertState } from 'app/types/unified-alerting-dto';
import React, { FC } from 'react';

type Props = Omit<SelectBaseProps<GrafanaAlertState>, 'options'>;

const options: SelectableValue[] = [
  { value: GrafanaAlertState.Alerting, label: 'Alerting' },
  { value: GrafanaAlertState.NoData, label: 'No Data' },
  { value: GrafanaAlertState.KeepLastState, label: 'Keep Last State' },
  { value: GrafanaAlertState.OK, label: 'OK' },
];

export const GrafanaAlertStatePicker: FC<Props> = (props) => <Select options={options} {...props} />;
