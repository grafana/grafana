import React from 'react';
import { config } from '@grafana/runtime';
import { Icon } from '@grafana/ui';
import { t } from 'app/core/internationalization';
export let getFooterLinks = () => {
    // @PERCONA
    return [
        {
            id: 'pmm-logs',
            text: 'PMM Logs',
            icon: 'download-alt',
            url: '/logs.zip',
            target: '_blank',
        },
        {
            target: '_blank',
            id: 'pmm-docs',
            text: t('nav.help/documentation', 'Documentation'),
            icon: 'document-info',
            url: 'https://per.co.na/pmm_documentation',
        },
        {
            target: '_blank',
            id: 'support',
            text: t('nav.help/support', 'Support'),
            icon: 'question-circle',
            url: 'https://per.co.na/pmm_support',
        },
        {
            target: '_blank',
            id: 'community',
            text: t('nav.help/community', 'Community'),
            icon: 'comments-alt',
            url: 'https://per.co.na/pmm_community',
        },
    ];
};
export function getVersionMeta(version) {
    const isBeta = version.includes('-beta');
    return {
        hasReleaseNotes: true,
        isBeta,
    };
}
export function getVersionLinks(hideEdition) {
    const { buildInfo, licenseInfo } = config;
    const links = [];
    const stateInfo = licenseInfo.stateInfo ? ` (${licenseInfo.stateInfo})` : '';
    if (!hideEdition) {
        links.push({
            target: '_blank',
            id: 'license',
            text: `${buildInfo.edition}${stateInfo}`,
            url: licenseInfo.licenseUrl,
        });
    }
    if (buildInfo.hideVersion) {
        return links;
    }
    const { hasReleaseNotes } = getVersionMeta(buildInfo.version);
    links.push({
        target: '_blank',
        id: 'version',
        text: `v${buildInfo.version} (${buildInfo.commit})`,
        url: hasReleaseNotes ? `https://github.com/grafana/grafana/blob/main/CHANGELOG.md` : undefined,
    });
    if (buildInfo.hasUpdate) {
        links.push({
            target: '_blank',
            id: 'updateVersion',
            text: `New version available!`,
            icon: 'download-alt',
            url: 'https://grafana.com/grafana/download?utm_source=grafana_footer',
        });
    }
    return links;
}
export function setFooterLinksFn(fn) {
    getFooterLinks = fn;
}
export const Footer = React.memo(({ customLinks }) => {
    // @PERCONA
    // remove version links
    const links = customLinks || getFooterLinks();
    return (React.createElement("footer", { className: "footer" },
        React.createElement("div", { className: "text-center" },
            React.createElement("ul", null, links.map((link) => (React.createElement("li", { key: link.text },
                React.createElement(FooterItem, { item: link }))))))));
});
Footer.displayName = 'Footer';
function FooterItem({ item }) {
    const content = item.url ? (React.createElement("a", { href: item.url, target: item.target, rel: "noopener noreferrer", id: item.id }, item.text)) : (item.text);
    return (React.createElement(React.Fragment, null,
        item.icon && React.createElement(Icon, { name: item.icon }),
        " ",
        content));
}
//# sourceMappingURL=Footer.js.map