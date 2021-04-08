import { config } from '@grafana/runtime';
import { RuleList } from './unified/RuleList';
import AlertRuleList from './AlertRuleList';

// route between unified and "old" alerting pages based on feature flag

export default config.featureToggles.ngalert ? RuleList : AlertRuleList;
