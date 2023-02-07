import { SelectableValue } from '@grafana/data';

import { AddDBClusterFormValues } from '../../../../../dbaas/components/DBCluster/EditDBClusterPage/EditDBClusterPage.types';
import { PeriodType } from '../../../../../shared/helpers/cron/types';
import { AddBackupFormProps } from '../../AddBackupPage.types';

export interface ScheduleSectionFieldsProps {
  values: AddBackupFormProps | AddDBClusterFormValues;
}

export enum ScheduleSectionFields {
  period = 'period',
  month = 'month',
  day = 'day',
  weekDay = 'weekDay',
  startHour = 'startHour',
  startMinute = 'startMinute',
}

export interface ScheduledSectionFieldsValuesProps {
  [ScheduleSectionFields.period]?: SelectableValue<PeriodType>;
  [ScheduleSectionFields.month]?: Array<SelectableValue<number>>;
  [ScheduleSectionFields.day]?: Array<SelectableValue<number>>;
  [ScheduleSectionFields.weekDay]?: Array<SelectableValue<number>>;
  [ScheduleSectionFields.startHour]?: Array<SelectableValue<number>>;
  [ScheduleSectionFields.startMinute]?: Array<SelectableValue<number>>;
}
