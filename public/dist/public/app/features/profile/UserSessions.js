import { css, cx } from '@emotion/css';
import { t } from 'i18next';
import React, { PureComponent } from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Button, Icon, LoadingPlaceholder } from '@grafana/ui';
import { i18nDate, Trans } from 'app/core/internationalization';
class UserSessions extends PureComponent {
    render() {
        const { isLoading, sessions, revokeUserSession } = this.props;
        const styles = getStyles();
        if (isLoading) {
            return React.createElement(LoadingPlaceholder, { text: React.createElement(Trans, { i18nKey: "user-sessions.loading" }, "Loading sessions...") });
        }
        return (React.createElement("div", { className: styles.wrapper }, sessions.length > 0 && (React.createElement(React.Fragment, null,
            React.createElement("h3", { className: "page-sub-heading" }, "Sessions"),
            React.createElement("div", { className: cx('gf-form-group', styles.table) },
                React.createElement("table", { className: "filter-table form-inline", "data-testid": selectors.components.UserProfile.sessionsTable },
                    React.createElement("thead", null,
                        React.createElement("tr", null,
                            React.createElement("th", null,
                                React.createElement(Trans, { i18nKey: "user-session.seen-at-column" }, "Last seen")),
                            React.createElement("th", null,
                                React.createElement(Trans, { i18nKey: "user-session.created-at-column" }, "Logged on")),
                            React.createElement("th", null,
                                React.createElement(Trans, { i18nKey: "user-session.ip-column" }, "IP address")),
                            React.createElement("th", null,
                                React.createElement(Trans, { i18nKey: "user-session.browser-column" }, "Browser & OS")),
                            React.createElement("th", null))),
                    React.createElement("tbody", null, sessions.map((session, index) => (React.createElement("tr", { key: index },
                        session.isActive ? React.createElement("td", null, "Now") : React.createElement("td", null, session.seenAt),
                        React.createElement("td", null, i18nDate(session.createdAt, { dateStyle: 'long' })),
                        React.createElement("td", null, session.clientIp),
                        React.createElement("td", null,
                            session.browser,
                            " on ",
                            session.os,
                            " ",
                            session.osVersion),
                        React.createElement("td", null,
                            React.createElement(Button, { size: "sm", variant: "destructive", onClick: () => revokeUserSession(session.id), "aria-label": t('user-session.revoke', 'Revoke user session') },
                                React.createElement(Icon, { name: "power" })))))))))))));
    }
}
const getStyles = () => ({
    wrapper: css({
        maxWidth: '100%',
    }),
    table: css({
        overflow: 'auto',
    }),
});
export default UserSessions;
//# sourceMappingURL=UserSessions.js.map