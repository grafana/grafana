import { css } from '@emotion/css';
import React from 'react';
import { useStyles2 } from '@grafana/ui';
import { Matchers } from '../../notification-policies/Matchers';
import { hasEmptyMatchers, isDefaultPolicy } from './route';
export function NotificationPolicyMatchers({ route }) {
    var _a;
    const styles = useStyles2(getStyles);
    if (isDefaultPolicy(route)) {
        return React.createElement("div", { className: styles.defaultPolicy }, "Default policy");
    }
    else if (hasEmptyMatchers(route)) {
        return React.createElement("div", { className: styles.textMuted }, "No matchers");
    }
    else {
        return React.createElement(Matchers, { matchers: (_a = route.object_matchers) !== null && _a !== void 0 ? _a : [] });
    }
}
const getStyles = (theme) => ({
    defaultPolicy: css `
    padding: ${theme.spacing(0.5)};
    background: ${theme.colors.background.secondary};
    width: fit-content;
  `,
    textMuted: css `
    color: ${theme.colors.text.secondary};
  `,
});
//# sourceMappingURL=NotificationPolicyMatchers.js.map