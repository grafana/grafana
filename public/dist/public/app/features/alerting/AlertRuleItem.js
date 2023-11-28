import React, { useCallback } from 'react';
import Highlighter from 'react-highlight-words';
import { Icon, Button, LinkButton, Card } from '@grafana/ui';
const AlertRuleItem = ({ rule, search, onTogglePause }) => {
    const ruleUrl = `${rule.url}?editPanel=${rule.panelId}&tab=alert`;
    const renderText = useCallback((text) => (React.createElement(Highlighter, { key: text, highlightClassName: "highlight-search-match", textToHighlight: text, searchWords: [search] })), [search]);
    return (React.createElement(Card, null,
        React.createElement(Card.Heading, null, renderText(rule.name)),
        React.createElement(Card.Figure, null,
            React.createElement(Icon, { size: "xl", name: rule.stateIcon, className: `alert-rule-item__icon ${rule.stateClass}` })),
        React.createElement(Card.Meta, null,
            React.createElement("span", { key: "state" },
                React.createElement("span", { key: "text", className: `${rule.stateClass}` },
                    renderText(rule.stateText),
                    ' '),
                "for ",
                rule.stateAge),
            rule.info ? renderText(rule.info) : null),
        React.createElement(Card.Actions, null,
            React.createElement(Button, { key: "play", variant: "secondary", icon: rule.state === 'paused' ? 'play' : 'pause', onClick: onTogglePause }, rule.state === 'paused' ? 'Resume' : 'Pause'),
            React.createElement(LinkButton, { key: "edit", variant: "secondary", href: ruleUrl, icon: "cog" }, "Edit alert"))));
};
export default AlertRuleItem;
//# sourceMappingURL=AlertRuleItem.js.map