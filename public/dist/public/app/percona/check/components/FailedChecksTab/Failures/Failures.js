/* eslint-disable @typescript-eslint/consistent-type-assertions */
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { Severity } from 'app/percona/integrated-alerting/components/Severity';
import { getStyles } from './Failures.styles';
import { failureToSeverity } from './Failures.utils';
export const Failures = ({ counts }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("ul", { className: styles.list }, Object.keys(counts).map((count) => counts[count] > 0 && (React.createElement("li", { key: count, className: styles.listItem },
        React.createElement(Severity, { severity: failureToSeverity(count) }),
        ' ',
        counts[count])))));
};
//# sourceMappingURL=Failures.js.map