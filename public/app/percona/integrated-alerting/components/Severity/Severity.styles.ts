import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';
import { AlertRuleSeverity } from '../AlertRules/AlertRules.types';

const getSeverityColor = ({ v1: { palette } }: GrafanaTheme2, severity: AlertRuleSeverity) => {
  const map: Record<AlertRuleSeverity, string> = {
    [AlertRuleSeverity.SEVERITY_CRITICAL]: palette.red,
    [AlertRuleSeverity.SEVERITY_ERROR]: palette.orange,
    [AlertRuleSeverity.SEVERITY_NOTICE]: palette.blue80,
    [AlertRuleSeverity.SEVERITY_WARNING]: palette.yellow,
  };

  return map[severity];
};

export const getStyles = stylesFactory((theme: GrafanaTheme2, severity: AlertRuleSeverity) => ({
  severity: css`
    color: ${getSeverityColor(theme, severity)};
  `,
}));
