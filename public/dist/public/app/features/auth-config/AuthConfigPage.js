import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { reportInteraction } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import ConfigureAuthCTA from './components/ConfigureAuthCTA';
import { ProviderCard } from './components/ProviderCard';
import { loadSettings } from './state/actions';
import { getProviderUrl } from './utils';
import { getRegisteredAuthProviders } from '.';
function mapStateToProps(state) {
    const { isLoading, providerStatuses } = state.authConfig;
    return {
        isLoading,
        providerStatuses,
    };
}
const mapDispatchToProps = {
    loadSettings,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export const AuthConfigPageUnconnected = ({ providerStatuses, isLoading, loadSettings }) => {
    const styles = useStyles2(getStyles);
    useEffect(() => {
        loadSettings();
    }, [loadSettings]);
    const authProviders = getRegisteredAuthProviders();
    const enabledProviders = authProviders.filter((p) => { var _a; return (_a = providerStatuses[p.id]) === null || _a === void 0 ? void 0 : _a.enabled; });
    const configuresProviders = authProviders.filter((p) => { var _a, _b; return ((_a = providerStatuses[p.id]) === null || _a === void 0 ? void 0 : _a.configured) && !((_b = providerStatuses[p.id]) === null || _b === void 0 ? void 0 : _b.enabled); });
    const availableProviders = authProviders.filter((p) => { var _a, _b, _c; return !((_a = providerStatuses[p.id]) === null || _a === void 0 ? void 0 : _a.enabled) && !((_b = providerStatuses[p.id]) === null || _b === void 0 ? void 0 : _b.configured) && !((_c = providerStatuses[p.id]) === null || _c === void 0 ? void 0 : _c.hide); });
    const firstAvailableProvider = (availableProviders === null || availableProviders === void 0 ? void 0 : availableProviders.length) ? availableProviders[0] : null;
    {
        /* TODO: make generic for the provider of the configuration or make the documentation point to a collection of all our providers */
    }
    const docsLink = (React.createElement("a", { className: "external-link", href: "https://grafana.com/docs/grafana/next/setup-grafana/configure-security/configure-authentication/saml-ui/", target: "_blank", rel: "noopener noreferrer" }, "documentation."));
    const subTitle = React.createElement("span", null,
        "Manage your auth settings and configure single sign-on. Find out more in our ",
        docsLink);
    const onCTAClick = () => {
        reportInteraction('authentication_ui_created', { provider: firstAvailableProvider === null || firstAvailableProvider === void 0 ? void 0 : firstAvailableProvider.type });
    };
    const onProviderCardClick = (provider) => {
        reportInteraction('authentication_ui_provider_clicked', { provider: provider.type });
    };
    return (React.createElement(Page, { navId: "authentication", subTitle: subTitle },
        React.createElement(Page.Contents, { isLoading: isLoading },
            React.createElement("h3", { className: styles.sectionHeader }, "Configured authentication"),
            !!(enabledProviders === null || enabledProviders === void 0 ? void 0 : enabledProviders.length) && (React.createElement("div", { className: styles.cardsContainer }, enabledProviders.map((provider) => {
                var _a, _b;
                return (React.createElement(ProviderCard, { key: provider.id, providerId: provider.id, displayName: ((_a = providerStatuses[provider.id]) === null || _a === void 0 ? void 0 : _a.name) || provider.displayName, authType: provider.protocol, enabled: (_b = providerStatuses[provider.id]) === null || _b === void 0 ? void 0 : _b.enabled, configPath: provider.configPath, onClick: () => onProviderCardClick(provider) }));
            }))),
            !(enabledProviders === null || enabledProviders === void 0 ? void 0 : enabledProviders.length) && firstAvailableProvider && !isEmpty(providerStatuses) && (React.createElement(ConfigureAuthCTA, { title: `You have no ${firstAvailableProvider.type} configuration created at the moment`, buttonIcon: "plus-circle", buttonLink: getProviderUrl(firstAvailableProvider), buttonTitle: `Configure ${firstAvailableProvider.type}`, onClick: onCTAClick })),
            !!(configuresProviders === null || configuresProviders === void 0 ? void 0 : configuresProviders.length) && (React.createElement("div", { className: styles.cardsContainer }, configuresProviders.map((provider) => {
                var _a, _b;
                return (React.createElement(ProviderCard, { key: provider.id, providerId: provider.id, displayName: ((_a = providerStatuses[provider.id]) === null || _a === void 0 ? void 0 : _a.name) || provider.displayName, authType: provider.protocol, enabled: (_b = providerStatuses[provider.id]) === null || _b === void 0 ? void 0 : _b.enabled, configPath: provider.configPath, onClick: () => onProviderCardClick(provider) }));
            }))))));
};
const getStyles = (theme) => {
    return {
        cardsContainer: css `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(288px, 1fr));
      gap: ${theme.spacing(3)};
      margin-bottom: ${theme.spacing(3)};
      margin-top: ${theme.spacing(2)};
    `,
        sectionHeader: css `
      margin-bottom: ${theme.spacing(3)};
    `,
        settingsSection: css `
      margin-top: ${theme.spacing(4)};
    `,
        settingName: css `
      padding-left: 25px;
    `,
        doclink: css `
      padding-bottom: 5px;
      padding-top: -5px;
      font-size: ${theme.typography.bodySmall.fontSize};
      a {
        color: ${theme.colors.info.name}; // use theme link color or any other color
        text-decoration: underline; // underline or none, as you prefer
      }
    `,
        settingValue: css `
      white-space: break-spaces;
    `,
    };
};
export default connector(AuthConfigPageUnconnected);
//# sourceMappingURL=AuthConfigPage.js.map