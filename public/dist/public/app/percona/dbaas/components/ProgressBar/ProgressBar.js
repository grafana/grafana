/* eslint-disable react/display-name */
import { cx } from '@emotion/css';
import React, { useMemo } from 'react';
import { useStyles } from '@grafana/ui';
import { getStyles } from './ProgressBar.styles';
import { ProgressBarStatus } from './ProgressBar.types';
import { getProgressBarPercentage } from './ProgressBar.utils';
export const ProgressBar = ({ finishedSteps, totalSteps, status, message, dataTestId }) => {
    const styles = useStyles(getStyles);
    const progressBarErrorStyles = useMemo(() => ({
        [styles.progressBarError]: status === ProgressBarStatus.error,
    }), [status, styles.progressBarError]);
    const stepsLabelErrorStyles = useMemo(() => ({
        [styles.stepsLabelError]: status === ProgressBarStatus.error,
    }), [status, styles.stepsLabelError]);
    const width = getProgressBarPercentage(finishedSteps, totalSteps);
    return (React.createElement("div", { className: styles.progressBarWrapper, "data-testid": dataTestId },
        React.createElement("div", { className: styles.labelWrapper },
            React.createElement("span", { "data-testid": "progress-bar-steps", className: cx(styles.stepsLabel, stepsLabelErrorStyles) }, finishedSteps === 0 && totalSteps === 0 ? '-/-' : `${finishedSteps}/${totalSteps}`),
            React.createElement("span", { "data-testid": "progress-bar-message", className: styles.message, title: message }, message)),
        React.createElement("div", { "data-testid": "progress-bar-content", className: styles.progressBarBackground },
            React.createElement("div", { className: cx(styles.getFillerStyles(width), progressBarErrorStyles) }))));
};
//# sourceMappingURL=ProgressBar.js.map