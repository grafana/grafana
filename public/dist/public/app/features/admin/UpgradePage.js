import { css } from '@emotion/css';
import React from 'react';
import { connect } from 'react-redux';
import { LinkButton, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from '../../core/selectors/navModel';
import { LicenseChrome } from './LicenseChrome';
import { ServerStats } from './ServerStats';
export function UpgradePage({ navModel }) {
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            React.createElement(ServerStats, null))));
}
const titleStyles = { fontWeight: 500, fontSize: '26px', lineHeight: '123%' };
export const UpgradeInfo = ({ editionNotice }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement(React.Fragment, null,
        React.createElement("h2", { className: styles.title }, "Enterprise license"),
        React.createElement(LicenseChrome, { header: "Grafana Enterprise", subheader: "Get your free trial", editionNotice: editionNotice },
            React.createElement("div", { className: styles.column },
                React.createElement(FeatureInfo, null),
                React.createElement(ServiceInfo, null)))));
};
const getStyles = (theme) => {
    return {
        column: css `
      display: grid;
      grid-template-columns: 100%;
      column-gap: 20px;
      row-gap: 40px;

      @media (min-width: 1050px) {
        grid-template-columns: 50% 50%;
      }
    `,
        title: css `
      margin: ${theme.spacing(4)} 0;
    `,
    };
};
const GetEnterprise = () => {
    return (React.createElement("div", { style: { marginTop: '40px', marginBottom: '30px' } },
        React.createElement("h2", { style: titleStyles }, "Get Grafana Enterprise"),
        React.createElement(CallToAction, null),
        React.createElement("p", { style: { paddingTop: '12px' } }, "You can use the trial version for free for 30 days. We will remind you about it five days before the trial period ends.")));
};
const CallToAction = () => {
    return (React.createElement(LinkButton, { variant: "primary", size: "lg", href: "https://grafana.com/contact?about=grafana-enterprise&utm_source=grafana-upgrade-page" }, "Contact us and get a free trial"));
};
const ServiceInfo = () => {
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
const FeatureInfo = () => {
    return (React.createElement("div", { style: { paddingRight: '11px' } },
        React.createElement("h4", null, "Enhanced functionality"),
        React.createElement(FeatureListing, null)));
};
const FeatureListing = () => {
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
const List = ({ children, nested }) => {
    const listStyle = css `
    display: flex;
    flex-direction: column;
    padding-top: 8px;

    > div {
      margin-bottom: ${nested ? 0 : 8}px;
    }
  `;
    return React.createElement("div", { className: listStyle }, children);
};
const Item = ({ children, title, image }) => {
    const imageUrl = image ? image : 'public/img/licensing/checkmark.svg';
    const itemStyle = css `
    display: flex;

    > img {
      display: block;
      height: 22px;
      flex-grow: 0;
      padding-right: 12px;
    }
  `;
    const titleStyle = css `
    font-weight: 500;
    line-height: 1.7;
  `;
    return (React.createElement("div", { className: itemStyle },
        React.createElement("img", { src: imageUrl, alt: "" }),
        React.createElement("div", null,
            React.createElement("div", { className: titleStyle }, title),
            children)));
};
const mapStateToProps = (state) => ({
    navModel: getNavModel(state.navIndex, 'upgrading'),
});
export default connect(mapStateToProps)(UpgradePage);
//# sourceMappingURL=UpgradePage.js.map