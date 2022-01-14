import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { css } from 'emotion';
import { AlertRuleSeverity } from '../AlertRules/AlertRules.types';

const getSeverityColor = ({ palette }: GrafanaTheme, severity: AlertRuleSeverity) => {
  const map: Record<AlertRuleSeverity, string> = {
    [AlertRuleSeverity.SEVERITY_CRITICAL]: palette.critical,
    [AlertRuleSeverity.SEVERITY_ERROR]: palette.orange,
    [AlertRuleSeverity.SEVERITY_NOTICE]: palette.blue80,
    [AlertRuleSeverity.SEVERITY_WARNING]: palette.yellow,
  };

  return map[severity];
};

export const getStyles = stylesFactory((theme: GrafanaTheme, severity: AlertRuleSeverity) => ({
  severity: css`
    color: ${getSeverityColor(theme, severity)};
  `,
}));
