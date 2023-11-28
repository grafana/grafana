import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
export function ConfigDescriptionLink(props) {
    const { description, suffix, feature } = props;
    const text = `Learn more about ${feature}`;
    const styles = useStyles2(getStyles);
    return (React.createElement("span", { className: styles.container },
        description,
        React.createElement("a", { "aria-label": text, href: `https://grafana.com/docs/grafana/next/datasources/${suffix}`, rel: "noreferrer", target: "_blank" }, text)));
}
const getStyles = (theme) => {
    return {
        container: css({
            color: theme.colors.text.secondary,
            a: css({
                color: theme.colors.text.link,
                textDecoration: 'underline',
                marginLeft: '5px',
                '&:hover': {
                    textDecoration: 'none',
                },
            }),
        }),
    };
};
//# sourceMappingURL=ConfigDescriptionLink.js.map