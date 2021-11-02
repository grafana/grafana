import React from 'react';
import config from 'app/core/config';
import { Icon } from '@grafana/ui';
export var getFooterLinks = function () {
    return [
        {
            text: 'Documentation',
            icon: 'document-info',
            url: 'https://grafana.com/docs/grafana/latest/?utm_source=grafana_footer',
            target: '_blank',
        },
        {
            text: 'Support',
            icon: 'question-circle',
            url: 'https://grafana.com/products/enterprise/?utm_source=grafana_footer',
            target: '_blank',
        },
        {
            text: 'Community',
            icon: 'comments-alt',
            url: 'https://community.grafana.com/?utm_source=grafana_footer',
            target: '_blank',
        },
    ];
};
export var getVersionLinks = function () {
    var buildInfo = config.buildInfo, licenseInfo = config.licenseInfo;
    var links = [];
    var stateInfo = licenseInfo.stateInfo ? " (" + licenseInfo.stateInfo + ")" : '';
    links.push({ text: "" + buildInfo.edition + stateInfo, url: licenseInfo.licenseUrl });
    if (buildInfo.hideVersion) {
        return links;
    }
    links.push({ text: "v" + buildInfo.version + " (" + buildInfo.commit + ")" });
    if (buildInfo.hasUpdate) {
        links.push({
            text: "New version available!",
            icon: 'download-alt',
            url: 'https://grafana.com/grafana/download?utm_source=grafana_footer',
            target: '_blank',
        });
    }
    return links;
};
export function setFooterLinksFn(fn) {
    getFooterLinks = fn;
}
export function setVersionLinkFn(fn) {
    getVersionLinks = fn;
}
export var Footer = React.memo(function () {
    var links = getFooterLinks().concat(getVersionLinks());
    return (React.createElement("footer", { className: "footer" },
        React.createElement("div", { className: "text-center" },
            React.createElement("ul", null, links.map(function (link) { return (React.createElement("li", { key: link.text },
                React.createElement("a", { href: link.url, target: link.target, rel: "noopener" },
                    link.icon && React.createElement(Icon, { name: link.icon }),
                    " ",
                    link.text))); })))));
});
Footer.displayName = 'Footer';
//# sourceMappingURL=Footer.js.map