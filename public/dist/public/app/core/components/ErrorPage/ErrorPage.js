import { __extends } from "tslib";
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { config } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import Page from '../Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
var ErrorPage = /** @class */ (function (_super) {
    __extends(ErrorPage, _super);
    function ErrorPage() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    ErrorPage.prototype.render = function () {
        var navModel = this.props.navModel;
        return (React.createElement(Page, { navModel: navModel },
            React.createElement(Page.Contents, null,
                React.createElement("div", { className: "page-container page-body" },
                    React.createElement("div", { className: "panel-container error-container" },
                        React.createElement("div", { className: "error-column graph-box" },
                            React.createElement("div", { className: "error-row" },
                                React.createElement("div", { className: "error-column error-space-between graph-percentage" },
                                    React.createElement("p", null, "100%"),
                                    React.createElement("p", null, "80%"),
                                    React.createElement("p", null, "60%"),
                                    React.createElement("p", null, "40%"),
                                    React.createElement("p", null, "20%"),
                                    React.createElement("p", null, "0%")),
                                React.createElement("div", { className: "error-column image-box" },
                                    React.createElement("img", { src: "public/img/graph404.svg", width: "100%", alt: "graph" }),
                                    React.createElement("div", { className: "error-row error-space-between" },
                                        React.createElement("p", { className: "graph-text" }, "Then"),
                                        React.createElement("p", { className: "graph-text" }, "Now"))))),
                        React.createElement("div", { className: "error-column info-box" },
                            React.createElement("div", { className: "error-row current-box" },
                                React.createElement("p", { className: "current-text" }, "current")),
                            React.createElement("div", { className: "error-row", style: { flex: 1 } },
                                React.createElement(Icon, { name: "minus-circle", className: "error-minus" }),
                                React.createElement("div", { className: "error-column error-space-between error-full-width" },
                                    React.createElement("div", { className: "error-row error-space-between" },
                                        React.createElement("p", null, "Chances you are on the page you are looking for."),
                                        React.createElement("p", { className: "left-margin" }, "0%")),
                                    React.createElement("div", null,
                                        React.createElement("h3", null, "Sorry for the inconvenience"),
                                        React.createElement("p", null,
                                            "Please go back to your",
                                            ' ',
                                            React.createElement("a", { href: config.appSubUrl, className: "error-link" }, "home dashboard"),
                                            ' ',
                                            "and try again."),
                                        React.createElement("p", null,
                                            "If the error persists, seek help on the",
                                            ' ',
                                            React.createElement("a", { href: "https://community.grafana.com", target: "_blank", rel: "noreferrer", className: "error-link" }, "community site"),
                                            "."))))))))));
    };
    return ErrorPage;
}(PureComponent));
export { ErrorPage };
var mapStateToProps = function (state) {
    return {
        navModel: getNavModel(state.navIndex, 'not-found'),
    };
};
export default connect(mapStateToProps)(ErrorPage);
//# sourceMappingURL=ErrorPage.js.map