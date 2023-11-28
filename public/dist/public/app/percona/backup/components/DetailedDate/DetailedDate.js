import { cx } from '@emotion/css';
import { format } from 'date-fns';
import React from 'react';
import { useStyles } from '@grafana/ui';
import { DAY_FORMAT, HOUR_FORMAT } from './DetailedDate.constants';
import { getStyles } from './DetailedDate.styles';
export const DetailedDate = ({ date, dayFormat = DAY_FORMAT, hourFormat = HOUR_FORMAT, dataTestId = 'detailed-date', className, }) => {
    const styles = useStyles(getStyles);
    const dayTime = format(date, dayFormat);
    const hourTime = format(date, hourFormat);
    return (React.createElement("span", { "data-testid": dataTestId, className: cx(className, styles.timeWrapper) },
        React.createElement("span", null, dayTime),
        React.createElement("span", { className: styles.hourWrapper }, hourTime)));
};
//# sourceMappingURL=DetailedDate.js.map