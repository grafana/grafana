import { SelectableValue } from '@grafana/data';
import { Severity } from '../../AlertRuleTemplate/AlertRuleTemplate.types';
import { AlertRule } from '../AlertRules.types';

export interface AddAlertRuleModalProps {
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  alertRule?: AlertRule;
}
export interface AddAlertRuleFormValues {
  template: SelectableValue<string>;
  name: string;
  duration: number;
  filters: string;
  notificationChannels: Array<SelectableValue<string>>;
  severity: SelectableValue<Severity>;
  enabled: boolean;
  [field: string]: any;
}
