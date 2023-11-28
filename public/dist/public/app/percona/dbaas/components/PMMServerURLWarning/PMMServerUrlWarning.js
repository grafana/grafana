import { cx } from '@emotion/css';
import React from 'react';
import { Link } from 'react-router-dom';
import { Card, useStyles } from '@grafana/ui';
import { Messages } from './PMMServerUrlWarning.messages';
import { getStyles } from './PMMServerUrlWarning.styles';
export const PMMServerUrlWarning = ({ className }) => {
    const styles = useStyles(getStyles);
    return (React.createElement(Card, { className: cx(styles.alert, className), "data-testid": "pmm-server-url-warning" },
        React.createElement(Card.Heading, null, Messages.heading),
        React.createElement(Card.Description, null,
            Messages.addressSet(window.location.host),
            Messages.editLater,
            React.createElement(Link, { to: "/settings/advanced-settings" }, Messages.advancedSettings),
            ".")));
};
//# sourceMappingURL=PMMServerUrlWarning.js.map