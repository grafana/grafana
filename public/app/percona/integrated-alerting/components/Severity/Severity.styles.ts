import { GrafanaTheme2 } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { css } from '@emotion/css';
import { Severity } from 'app/percona/shared/core';

const getSeverityColor = ({ v1: { palette } }: GrafanaTheme2, severity: Severity) => {
  const map: Record<Severity, string> = {
    [Severity.SEVERITY_EMERGENCY]: palette.red,
    [Severity.SEVERITY_ALERT]: palette.red,
    [Severity.SEVERITY_CRITICAL]: palette.red,
    [Severity.SEVERITY_ERROR]: palette.orange,
    [Severity.SEVERITY_WARNING]: palette.yellow,
    [Severity.SEVERITY_NOTICE]: palette.blue80,
    [Severity.SEVERITY_INFO]: palette.blue80,
    [Severity.SEVERITY_DEBUG]: palette.blue80,
  };

  return map[severity];
};

export const getStyles = stylesFactory((theme: GrafanaTheme2, severity: Severity) => ({
  severity: css`
    color: ${getSeverityColor(theme, severity)};
  `,
}));
