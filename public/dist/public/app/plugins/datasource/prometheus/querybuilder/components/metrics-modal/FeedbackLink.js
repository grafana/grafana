import { css } from '@emotion/css';
import React from 'react';
import { Stack } from '@grafana/experimental';
import { Icon, useStyles2 } from '@grafana/ui';
export function FeedbackLink({ feedbackUrl }) {
    const styles = useStyles2(getStyles);
    return (React.createElement(Stack, null,
        React.createElement("a", { href: feedbackUrl, className: styles.link, title: "The metrics explorer is new, please let us know how we can improve it", target: "_blank", rel: "noreferrer noopener" },
            React.createElement(Icon, { name: "comment-alt-message" }),
            " Give feedback")));
}
function getStyles(theme) {
    return {
        link: css({
            color: theme.colors.text.secondary,
            fontSize: theme.typography.bodySmall.fontSize,
            ':hover': {
                color: theme.colors.text.link,
            },
            margin: `-25px 0 30px 0`,
        }),
    };
}
//# sourceMappingURL=FeedbackLink.js.map