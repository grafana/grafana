import * as tslib_1 from "tslib";
// Libraries
import React, { Component } from 'react';
import config from 'app/core/config';
import { getTitleFromNavModel } from 'app/core/selectors/navModel';
// Components
import PageHeader from '../PageHeader/PageHeader';
import Footer from '../Footer/Footer';
import PageContents from './PageContents';
import { CustomScrollbar } from '@grafana/ui';
import { isEqual } from 'lodash';
var Page = /** @class */ (function (_super) {
    tslib_1.__extends(Page, _super);
    function Page() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.updateTitle = function () {
            var title = _this.getPageTitle;
            document.title = title ? title + ' - Grafana' : 'Grafana';
        };
        return _this;
    }
    Page.prototype.componentDidMount = function () {
        this.updateTitle();
    };
    Page.prototype.componentDidUpdate = function (prevProps) {
        if (!isEqual(prevProps.navModel, this.props.navModel)) {
            this.updateTitle();
        }
    };
    Object.defineProperty(Page.prototype, "getPageTitle", {
        get: function () {
            var navModel = this.props.navModel;
            if (navModel) {
                return getTitleFromNavModel(navModel) || undefined;
            }
            return undefined;
        },
        enumerable: true,
        configurable: true
    });
    Page.prototype.render = function () {
        var navModel = this.props.navModel;
        var buildInfo = config.buildInfo;
        return (React.createElement("div", { className: "page-scrollbar-wrapper" },
            React.createElement(CustomScrollbar, { autoHeightMin: '100%', className: "custom-scrollbar--page" },
                React.createElement("div", { className: "page-scrollbar-content" },
                    React.createElement(PageHeader, { model: navModel }),
                    this.props.children,
                    React.createElement(Footer, { appName: "Grafana", buildCommit: buildInfo.commit, buildVersion: buildInfo.version, newGrafanaVersion: buildInfo.latestVersion, newGrafanaVersionExists: buildInfo.hasUpdate })))));
    };
    Page.Header = PageHeader;
    Page.Contents = PageContents;
    return Page;
}(Component));
export default Page;
//# sourceMappingURL=Page.js.map