import React from 'react';
import { cx } from '@emotion/css';
export var Card = function (_a) {
    var logoUrl = _a.logoUrl, title = _a.title, description = _a.description, labels = _a.labels, actions = _a.actions, onClick = _a.onClick, ariaLabel = _a.ariaLabel, className = _a.className;
    var mainClassName = cx('add-data-source-item', className);
    return (React.createElement("div", { className: mainClassName, onClick: onClick, "aria-label": ariaLabel },
        logoUrl && React.createElement("img", { className: "add-data-source-item-logo", src: logoUrl }),
        React.createElement("div", { className: "add-data-source-item-text-wrapper" },
            React.createElement("span", { className: "add-data-source-item-text" }, title),
            description && React.createElement("span", { className: "add-data-source-item-desc" }, description),
            labels && React.createElement("div", { className: "add-data-source-item-badge" }, labels)),
        actions && React.createElement("div", { className: "add-data-source-item-actions" }, actions)));
};
//# sourceMappingURL=Card.js.map