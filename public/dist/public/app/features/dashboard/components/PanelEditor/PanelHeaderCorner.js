import React, { Component } from 'react';
import { renderMarkdown } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { locationService, getTemplateSrv } from '@grafana/runtime';
import { Tooltip } from '@grafana/ui';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { InspectTab } from 'app/features/inspector/types';
var InfoMode;
(function (InfoMode) {
    InfoMode["Error"] = "Error";
    InfoMode["Info"] = "Info";
    InfoMode["Links"] = "Links";
})(InfoMode || (InfoMode = {}));
export class PanelHeaderCorner extends Component {
    constructor() {
        super(...arguments);
        this.timeSrv = getTimeSrv();
        this.getInfoMode = () => {
            const { panel, error } = this.props;
            if (error) {
                return InfoMode.Error;
            }
            if (!!panel.description) {
                return InfoMode.Info;
            }
            if (panel.links && panel.links.length) {
                return InfoMode.Links;
            }
            return undefined;
        };
        this.getInfoContent = () => {
            const { panel } = this.props;
            const markdown = panel.description || '';
            const interpolatedMarkdown = getTemplateSrv().replace(markdown, panel.scopedVars);
            const markedInterpolatedMarkdown = renderMarkdown(interpolatedMarkdown);
            const links = this.props.links && this.props.links.getLinks(panel.replaceVariables);
            return (React.createElement("div", { className: "panel-info-content markdown-html" },
                React.createElement("div", { dangerouslySetInnerHTML: { __html: markedInterpolatedMarkdown } }),
                links && links.length > 0 && (React.createElement("ul", { className: "panel-info-corner-links" }, links.map((link, idx) => {
                    return (React.createElement("li", { key: idx },
                        React.createElement("a", { className: "panel-info-corner-links__item", href: link.href, target: link.target }, link.title)));
                })))));
        };
        /**
         * Open the Panel Inspector when we click on an error
         */
        this.onClickError = () => {
            locationService.partial({
                inspect: this.props.panel.id,
                inspectTab: InspectTab.Error,
            });
        };
    }
    renderCornerType(infoMode, content, onClick) {
        const theme = infoMode === InfoMode.Error ? 'error' : 'info';
        const className = `panel-info-corner panel-info-corner--${infoMode.toLowerCase()}`;
        const ariaLabel = selectors.components.Panels.Panel.headerCornerInfo(infoMode.toLowerCase());
        return (React.createElement(Tooltip, { content: content, placement: "top-start", theme: theme, interactive: true },
            React.createElement("button", { type: "button", className: className, onClick: onClick, "aria-label": ariaLabel },
                React.createElement("i", { "aria-hidden": true, className: "fa" }),
                React.createElement("span", { className: "panel-info-corner-inner" }))));
    }
    render() {
        const { error } = this.props;
        const infoMode = this.getInfoMode();
        if (!infoMode) {
            return null;
        }
        if (infoMode === InfoMode.Error && error) {
            return this.renderCornerType(infoMode, error, this.onClickError);
        }
        if (infoMode === InfoMode.Info || infoMode === InfoMode.Links) {
            return this.renderCornerType(infoMode, this.getInfoContent);
        }
        return null;
    }
}
export default PanelHeaderCorner;
//# sourceMappingURL=PanelHeaderCorner.js.map