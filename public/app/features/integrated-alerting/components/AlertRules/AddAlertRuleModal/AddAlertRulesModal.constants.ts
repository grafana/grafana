import { Severity } from './AddAlertRuleModal.types';
import { Messages } from './AddAlertRuleModal.messages';

// TODO: generate SEVERITY_OPTIONS from its type definitions
export const SEVERITY_OPTIONS = [
  {
    value: Severity.SEVERITY_CRITICAL,
    label: Messages.severities.SEVERITY_CRITICAL,
  },
  {
    value: Severity.SEVERITY_ERROR,
    label: Messages.severities.SEVERITY_ERROR,
  },
  {
    value: Severity.SEVERITY_NOTICE,
    label: Messages.severities.SEVERITY_NOTICE,
  },
  {
    value: Severity.SEVERITY_WARNING,
    label: Messages.severities.SEVERITY_WARNING,
  },
];
