import { css } from '@emotion/css';
import React from 'react';
import { Card, useStyles2 } from '@grafana/ui';
export function NavLandingPageCard({ description, text, url }) {
    const styles = useStyles2(getStyles);
    return (React.createElement(Card, { className: styles.card, href: url },
        React.createElement(Card.Heading, null, text),
        React.createElement(Card.Description, { className: styles.description }, description)));
}
const getStyles = (theme) => ({
    card: css({
        marginBottom: 0,
        gridTemplateRows: '1fr 0 2fr',
    }),
    // Limit descriptions to 3 lines max before ellipsing
    // Some plugin descriptions can be very long
    description: css({
        WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical',
        display: '-webkit-box',
        overflow: 'hidden',
    }),
});
//# sourceMappingURL=NavLandingPageCard.js.map