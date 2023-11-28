import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export function DataSourceTitle({ title }) {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.container },
        React.createElement("h1", { className: styles.title }, title)));
}
const getStyles = (theme) => {
    return {
        container: css({
            marginBottom: theme.spacing(2),
            h1: {
                display: 'inline-block',
            },
        }),
        title: css({
            display: 'inline-block',
            margin: '0 0 0 0',
            maxWidth: '40vw',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        }),
    };
};
//# sourceMappingURL=DataSourceTitle.js.map