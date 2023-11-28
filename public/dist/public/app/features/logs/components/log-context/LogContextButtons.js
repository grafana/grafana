import { css } from '@emotion/css';
import React, { useCallback } from 'react';
import { reportInteraction } from '@grafana/runtime';
import { Button, InlineSwitch, useStyles2 } from '@grafana/ui';
function getStyles(theme) {
    return {
        buttons: css({
            display: 'flex',
            gap: theme.spacing(1),
        }),
    };
}
export const LogContextButtons = (props) => {
    const styles = useStyles2(getStyles);
    const { wrapLines, onChangeWrapLines, onScrollCenterClick } = props;
    const internalOnChangeWrapLines = useCallback((event) => {
        const state = event.currentTarget.checked;
        reportInteraction('grafana_explore_logs_log_context_toggle_lines_clicked', {
            state,
        });
        onChangeWrapLines(state);
    }, [onChangeWrapLines]);
    return (React.createElement("div", { className: styles.buttons },
        React.createElement(InlineSwitch, { showLabel: true, value: wrapLines, onChange: internalOnChangeWrapLines, label: "Wrap lines" }),
        React.createElement(Button, { variant: "secondary", onClick: onScrollCenterClick }, "Center matched line")));
};
//# sourceMappingURL=LogContextButtons.js.map