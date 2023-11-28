import { css } from '@emotion/css';
import { noop } from 'lodash';
import React from 'react';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';
export const VersionHistoryHeader = ({ onClick = noop, baseVersion = 0, newVersion = 0, isNewLatest = false, }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("h3", { className: styles.header },
        React.createElement(IconButton, { name: "arrow-left", size: "xl", onClick: onClick, tooltip: "Reset version" }),
        React.createElement("span", null,
            "Comparing ",
            baseVersion,
            " ",
            React.createElement(Icon, { name: "arrows-h" }),
            " ",
            newVersion,
            ' ',
            isNewLatest && React.createElement("cite", { className: "muted" }, "(Latest)"))));
};
const getStyles = (theme) => ({
    header: css `
    font-size: ${theme.typography.h3.fontSize};
    display: flex;
    gap: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(3)};
  `,
});
//# sourceMappingURL=VersionHistoryHeader.js.map