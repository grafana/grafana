import { SelectableValue } from '@grafana/data';
import { Databases, DATABASE_LABELS } from 'app/percona/shared/core';

export const VENDOR_OPTIONS: Array<SelectableValue<Databases>> = [
  {
    value: Databases.mysql,
    label: DATABASE_LABELS.mysql,
  },
  {
    value: Databases.mongodb,
    label: DATABASE_LABELS.mongodb,
  },
  {
    value: Databases.postgresql,
    label: DATABASE_LABELS.postgresql,
  },
  {
    value: Databases.proxysql,
    label: DATABASE_LABELS.proxysql,
  },
];
