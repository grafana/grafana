import { SelectableValue } from '@grafana/data';
import { AlertRuleFilterType, Severity } from 'app/percona/shared/core';

export interface AddAlertRuleFormValues {
  template: SelectableValue<string>;
  name: string;
  duration: number;
  filters: FiltersForm[];
  notificationChannels: Array<SelectableValue<string>>;
  severity: SelectableValue<keyof typeof Severity>;
  enabled: boolean;
  [field: string]:
    | number
    | undefined
    | string
    | FiltersForm[]
    | Array<SelectableValue<string>>
    | SelectableValue<string>
    | boolean;
}

export interface NotificationListResponse {
  alertmanager_config: AlertManagerConfig;
}

interface AlertManagerConfig {
  route: {
    receiver: string;
  };
  receivers: Receiver[];
}

interface Receiver {
  name: string;
}

export interface FiltersForm {
  label: string;
  regexp: string;
  type: AlertRuleFilterType;
}
