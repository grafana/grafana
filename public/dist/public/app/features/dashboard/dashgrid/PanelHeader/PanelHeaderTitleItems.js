import { css, cx } from '@emotion/css';
import React from 'react';
import { AlertState } from '@grafana/data';
import { Icon, PanelChrome, Tooltip, useStyles2, TimePickerTooltip } from '@grafana/ui';
import { PanelLinks } from '../PanelLinks';
import { PanelHeaderNotices } from './PanelHeaderNotices';
export function PanelHeaderTitleItems(props) {
    var _a, _b, _c;
    const { alertState, data, panelId, onShowPanelLinks, panelLinks, angularNotice } = props;
    const styles = useStyles2(getStyles);
    // panel health
    const alertStateItem = (React.createElement(Tooltip, { content: alertState !== null && alertState !== void 0 ? alertState : 'unknown' },
        React.createElement(PanelChrome.TitleItem, { className: cx({
                [styles.ok]: alertState === AlertState.OK,
                [styles.pending]: alertState === AlertState.Pending,
                [styles.alerting]: alertState === AlertState.Alerting,
            }) },
            React.createElement(Icon, { name: alertState === 'alerting' ? 'heart-break' : 'heart', className: "panel-alert-icon", size: "md" }))));
    const timeshift = (React.createElement(React.Fragment, null, data.request && data.request.timeInfo && (React.createElement(Tooltip, { content: React.createElement(TimePickerTooltip, { timeRange: (_a = data.request) === null || _a === void 0 ? void 0 : _a.range, timeZone: (_b = data.request) === null || _b === void 0 ? void 0 : _b.timezone }) },
        React.createElement(PanelChrome.TitleItem, { className: styles.timeshift },
            React.createElement(Icon, { name: "clock-nine", size: "md" }),
            " ", (_c = data.request) === null || _c === void 0 ? void 0 :
            _c.timeInfo)))));
    const message = `This ${pluginType(angularNotice)} requires Angular (deprecated).`;
    const angularNoticeTooltip = (React.createElement(Tooltip, { content: message },
        React.createElement(PanelChrome.TitleItem, { className: styles.angularNotice, "data-testid": "angular-deprecation-icon" },
            React.createElement(Icon, { name: "exclamation-triangle", size: "md" }))));
    return (React.createElement(React.Fragment, null,
        panelLinks && panelLinks.length > 0 && onShowPanelLinks && (React.createElement(PanelLinks, { onShowPanelLinks: onShowPanelLinks, panelLinks: panelLinks })),
        React.createElement(PanelHeaderNotices, { panelId: panelId, frames: data.series }),
        timeshift,
        alertState && alertStateItem,
        (angularNotice === null || angularNotice === void 0 ? void 0 : angularNotice.show) && angularNoticeTooltip));
}
const pluginType = (angularNotice) => {
    if (angularNotice === null || angularNotice === void 0 ? void 0 : angularNotice.isAngularPanel) {
        return 'panel';
    }
    if (angularNotice === null || angularNotice === void 0 ? void 0 : angularNotice.isAngularDatasource) {
        return 'data source';
    }
    return 'panel or data source';
};
const getStyles = (theme) => {
    return {
        ok: css({
            color: theme.colors.success.text,
        }),
        pending: css({
            color: theme.colors.warning.text,
        }),
        alerting: css({
            color: theme.colors.error.text,
        }),
        timeshift: css({
            color: theme.colors.text.link,
            gap: theme.spacing(0.5),
            whiteSpace: 'nowrap',
            '&:hover': {
                color: theme.colors.emphasize(theme.colors.text.link, 0.03),
            },
        }),
        angularNotice: css({
            color: theme.colors.warning.text,
        }),
    };
};
//# sourceMappingURL=PanelHeaderTitleItems.js.map