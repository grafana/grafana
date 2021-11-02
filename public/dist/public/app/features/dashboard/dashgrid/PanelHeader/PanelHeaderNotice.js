import React from 'react';
import { Icon, Tooltip } from '@grafana/ui';
export var PanelHeaderNotice = function (_a) {
    var notice = _a.notice, onClick = _a.onClick;
    var iconName = notice.severity === 'error' || notice.severity === 'warning' ? 'exclamation-triangle' : 'info-circle';
    return (React.createElement(Tooltip, { content: notice.text, key: notice.severity }, notice.inspect ? (React.createElement("div", { className: "panel-info-notice pointer", onClick: function (e) { return onClick(e, notice.inspect); } },
        React.createElement(Icon, { name: iconName, style: { marginRight: '8px' } }))) : (React.createElement("a", { className: "panel-info-notice", href: notice.link, target: "_blank", rel: "noreferrer" },
        React.createElement(Icon, { name: iconName, style: { marginRight: '8px' } })))));
};
//# sourceMappingURL=PanelHeaderNotice.js.map