import * as tslib_1 from "tslib";
import React, { PureComponent } from 'react';
import Highlighter from 'react-highlight-words';
import classNames from 'classnames';
var AlertRuleItem = /** @class */ (function (_super) {
    tslib_1.__extends(AlertRuleItem, _super);
    function AlertRuleItem() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    AlertRuleItem.prototype.renderText = function (text) {
        return (React.createElement(Highlighter, { highlightClassName: "highlight-search-match", textToHighlight: text, searchWords: [this.props.search] }));
    };
    AlertRuleItem.prototype.render = function () {
        var _a = this.props, rule = _a.rule, onTogglePause = _a.onTogglePause;
        var iconClassName = classNames({
            fa: true,
            'fa-play': rule.state === 'paused',
            'fa-pause': rule.state !== 'paused',
        });
        var ruleUrl = rule.url + "?panelId=" + rule.panelId + "&fullscreen&edit&tab=alert";
        return (React.createElement("li", { className: "alert-rule-item" },
            React.createElement("span", { className: "alert-rule-item__icon " + rule.stateClass },
                React.createElement("i", { className: rule.stateIcon })),
            React.createElement("div", { className: "alert-rule-item__body" },
                React.createElement("div", { className: "alert-rule-item__header" },
                    React.createElement("div", { className: "alert-rule-item__name" },
                        React.createElement("a", { href: ruleUrl }, this.renderText(rule.name))),
                    React.createElement("div", { className: "alert-rule-item__text" },
                        React.createElement("span", { className: "" + rule.stateClass }, this.renderText(rule.stateText)),
                        React.createElement("span", { className: "alert-rule-item__time" },
                            " for ",
                            rule.stateAge))),
                rule.info && React.createElement("div", { className: "small muted alert-rule-item__info" }, this.renderText(rule.info))),
            React.createElement("div", { className: "alert-rule-item__actions" },
                React.createElement("button", { className: "btn btn-small btn-inverse alert-list__btn width-2", title: "Pausing an alert rule prevents it from executing", onClick: onTogglePause },
                    React.createElement("i", { className: iconClassName })),
                React.createElement("a", { className: "btn btn-small btn-inverse alert-list__btn width-2", href: ruleUrl, title: "Edit alert rule" },
                    React.createElement("i", { className: "icon-gf icon-gf-settings" })))));
    };
    return AlertRuleItem;
}(PureComponent));
export default AlertRuleItem;
//# sourceMappingURL=AlertRuleItem.js.map