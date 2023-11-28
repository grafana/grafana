import { css } from '@emotion/css';
import { stylesFactory } from '@grafana/ui';
import { Severity } from 'app/percona/shared/core';
const getSeverityColor = ({ v1: { palette } }, severity) => {
    const map = {
        [Severity.SEVERITY_EMERGENCY]: palette.red,
        [Severity.SEVERITY_ALERT]: palette.red,
        [Severity.SEVERITY_CRITICAL]: palette.red,
        [Severity.SEVERITY_ERROR]: palette.orange,
        [Severity.SEVERITY_WARNING]: palette.yellow,
        [Severity.SEVERITY_NOTICE]: palette.blue80,
        [Severity.SEVERITY_INFO]: palette.blue80,
        [Severity.SEVERITY_DEBUG]: palette.blue80,
    };
    return map.hasOwnProperty(severity) ? map[severity] : '';
};
export const getStyles = stylesFactory((theme, severity) => ({
    severity: css `
    color: ${getSeverityColor(theme, severity)};
  `,
}));
//# sourceMappingURL=Severity.styles.js.map