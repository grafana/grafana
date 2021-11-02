import { __makeTemplateObject } from "tslib";
import React from 'react';
import { connect } from 'react-redux';
import { css } from '@emotion/css';
import { LinkButton, useStyles2 } from '@grafana/ui';
import Page from '../../core/components/Page/Page';
import { getNavModel } from '../../core/selectors/navModel';
import { LicenseChrome } from './LicenseChrome';
import { ServerStats } from './ServerStats';
export var UpgradePage = function (_a) {
    var navModel = _a.navModel;
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement(ServerStats, null),
            React.createElement(UpgradeInfo, { editionNotice: "You are running the open-source version of Grafana.\n        You have to install the Enterprise edition in order enable Enterprise features." }))));
};
var titleStyles = { fontWeight: 500, fontSize: '26px', lineHeight: '123%' };
export var UpgradeInfo = function (_a) {
    var editionNotice = _a.editionNotice;
    var styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h2", { className: styles.title }, "Enterprise license"),
        React.createElement(LicenseChrome, { header: "Grafana Enterprise", subheader: "Get your free trial", editionNotice: editionNotice },
            React.createElement("div", { className: styles.column },
                React.createElement(FeatureInfo, null),
                React.createElement(ServiceInfo, null)))));
};
var getStyles = function (theme) {
    return {
        column: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      display: grid;\n      grid-template-columns: 100%;\n      column-gap: 20px;\n      row-gap: 40px;\n\n      @media (min-width: 1050px) {\n        grid-template-columns: 50% 50%;\n      }\n    "], ["\n      display: grid;\n      grid-template-columns: 100%;\n      column-gap: 20px;\n      row-gap: 40px;\n\n      @media (min-width: 1050px) {\n        grid-template-columns: 50% 50%;\n      }\n    "]))),
        title: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin: ", " 0;\n    "], ["\n      margin: ", " 0;\n    "])), theme.spacing(4)),
    };
};
var GetEnterprise = function () {
    return (React.createElement("div", { style: { marginTop: '40px', marginBottom: '30px' } },
        React.createElement("h2", { style: titleStyles }, "Get Grafana Enterprise"),
        React.createElement(CallToAction, null),
        React.createElement("p", { style: { paddingTop: '12px' } }, "You can use the trial version for free for 30 days. We will remind you about it five days before the trial period ends.")));
};
var CallToAction = function () {
    return (React.createElement(LinkButton, { variant: "primary", size: "lg", href: "https://grafana.com/contact?about=grafana-enterprise&utm_source=grafana-upgrade-page" }, "Contact us and get a free trial"));
};
var ServiceInfo = function () {
    return (React.createElement("div", null,
        React.createElement("h4", null, "At your service"),
        React.createElement(List, null,
            React.createElement(Item, { title: "Enterprise Plugins", image: "public/img/licensing/plugin_enterprise.svg" }),
            React.createElement(Item, { title: "Critical SLA: 2 hours", image: "public/img/licensing/sla.svg" }),
            React.createElement(Item, { title: "Unlimited Expert Support", image: "public/img/licensing/customer_support.svg" },
                "24 x 7 x 365 support via",
                React.createElement(List, { nested: true },
                    React.createElement(Item, { title: "Email" }),
                    React.createElement(Item, { title: "Private Slack channel" }),
                    React.createElement(Item, { title: "Phone" }))),
            React.createElement(Item, { title: "Hand-in-hand support", image: "public/img/licensing/handinhand_support.svg" }, "in the upgrade process")),
        React.createElement("div", { style: { marginTop: '20px' } },
            React.createElement("strong", null, "Also included:"),
            React.createElement("br", null),
            "Indemnification, working with Grafana Labs on future prioritization, and training from the core Grafana team."),
        React.createElement(GetEnterprise, null)));
};
var FeatureInfo = function () {
    return (React.createElement("div", { style: { paddingRight: '11px' } },
        React.createElement("h4", null, "Enhanced functionality"),
        React.createElement(FeatureListing, null)));
};
var FeatureListing = function () {
    return (React.createElement(List, null,
        React.createElement(Item, { title: "Data source permissions" }),
        React.createElement(Item, { title: "Reporting" }),
        React.createElement(Item, { title: "SAML authentication" }),
        React.createElement(Item, { title: "Enhanced LDAP integration" }),
        React.createElement(Item, { title: "Team Sync" }, "LDAP, GitHub OAuth, Auth Proxy, Okta"),
        React.createElement(Item, { title: "White labeling" }),
        React.createElement(Item, { title: "Auditing" }),
        React.createElement(Item, { title: "Settings updates at runtime" }),
        React.createElement(Item, { title: "Grafana usage insights" },
            React.createElement(List, { nested: true },
                React.createElement(Item, { title: "Sort dashboards by popularity in search" }),
                React.createElement(Item, { title: "Find unused dashboards" }),
                React.createElement(Item, { title: "Dashboard usage stats drawer" }),
                React.createElement(Item, { title: "Dashboard presence indicators" }))),
        React.createElement(Item, { title: "Enterprise plugins" },
            React.createElement(List, { nested: true },
                React.createElement(Item, { title: "Oracle" }),
                React.createElement(Item, { title: "Splunk" }),
                React.createElement(Item, { title: "Service Now" }),
                React.createElement(Item, { title: "Dynatrace" }),
                React.createElement(Item, { title: "New Relic" }),
                React.createElement(Item, { title: "DataDog" }),
                React.createElement(Item, { title: "AppDynamics" }),
                React.createElement(Item, { title: "SAP HANA\u00AE" }),
                React.createElement(Item, { title: "Gitlab" }),
                React.createElement(Item, { title: "Honeycomb" }),
                React.createElement(Item, { title: "Jira" }),
                React.createElement(Item, { title: "MongoDB" }),
                React.createElement(Item, { title: "Salesforce" }),
                React.createElement(Item, { title: "Snowflake" }),
                React.createElement(Item, { title: "Wavefront" })))));
};
var List = function (_a) {
    var children = _a.children, nested = _a.nested;
    var listStyle = css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n    display: flex;\n    flex-direction: column;\n    padding-top: 8px;\n\n    > div {\n      margin-bottom: ", "px;\n    }\n  "], ["\n    display: flex;\n    flex-direction: column;\n    padding-top: 8px;\n\n    > div {\n      margin-bottom: ", "px;\n    }\n  "])), nested ? 0 : 8);
    return React.createElement("div", { className: listStyle }, children);
};
var Item = function (_a) {
    var children = _a.children, title = _a.title, image = _a.image;
    var imageUrl = image ? image : 'public/img/licensing/checkmark.svg';
    var itemStyle = css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n    display: flex;\n\n    > img {\n      display: block;\n      height: 22px;\n      flex-grow: 0;\n      padding-right: 12px;\n    }\n  "], ["\n    display: flex;\n\n    > img {\n      display: block;\n      height: 22px;\n      flex-grow: 0;\n      padding-right: 12px;\n    }\n  "])));
    var titleStyle = css(templateObject_5 || (templateObject_5 = __makeTemplateObject(["\n    font-weight: 500;\n    line-height: 1.7;\n  "], ["\n    font-weight: 500;\n    line-height: 1.7;\n  "])));
    return (React.createElement("div", { className: itemStyle },
        React.createElement("img", { src: imageUrl, alt: "" }),
        React.createElement("div", null,
            React.createElement("div", { className: titleStyle }, title),
            children)));
};
var mapStateToProps = function (state) { return ({
    navModel: getNavModel(state.navIndex, 'upgrading'),
}); };
export default connect(mapStateToProps)(UpgradePage);
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
//# sourceMappingURL=UpgradePage.js.map