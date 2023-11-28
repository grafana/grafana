import { css } from '@emotion/css';
import React from 'react';
import { PluginErrorCode, PluginSignatureStatus } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Alert, HorizontalGroup, Icon, List, PluginSignatureBadge, useStyles2 } from '@grafana/ui';
import { useGetErrors, useFetchStatus } from '../admin/state/hooks';
export function PluginsErrorsInfo({ filterByPluginType }) {
    let errors = useGetErrors(filterByPluginType);
    const { isLoading } = useFetchStatus();
    const styles = useStyles2(getStyles);
    if (isLoading || errors.length === 0) {
        return null;
    }
    return (React.createElement(Alert, { title: "Unsigned plugins were found during plugin initialization. Grafana Labs cannot guarantee the integrity of these plugins. We recommend only using signed plugins.", "aria-label": selectors.pages.PluginsList.signatureErrorNotice, severity: "warning" },
        React.createElement("p", null, "The following plugins are disabled and not shown in the list below:"),
        React.createElement(List, { items: errors, className: styles.list, renderItem: (error) => (React.createElement("div", { className: styles.wrapper },
                React.createElement(HorizontalGroup, { spacing: "sm", justify: "flex-start", align: "center" },
                    React.createElement("strong", null, error.pluginId),
                    React.createElement(PluginSignatureBadge, { status: mapPluginErrorCodeToSignatureStatus(error.errorCode), className: styles.badge })))) }),
        React.createElement("a", { href: "https://grafana.com/docs/grafana/latest/plugins/plugin-signatures/", className: styles.docsLink, target: "_blank", rel: "noreferrer" },
            React.createElement(Icon, { name: "book" }),
            " Read more about plugin signing")));
}
function mapPluginErrorCodeToSignatureStatus(code) {
    switch (code) {
        case PluginErrorCode.invalidSignature:
            return PluginSignatureStatus.invalid;
        case PluginErrorCode.missingSignature:
            return PluginSignatureStatus.missing;
        case PluginErrorCode.modifiedSignature:
            return PluginSignatureStatus.modified;
        default:
            return PluginSignatureStatus.missing;
    }
}
function getStyles(theme) {
    return {
        list: css({
            listStyleType: 'circle',
        }),
        wrapper: css({
            marginTop: theme.spacing(1),
        }),
        badge: css({
            marginTop: 0,
        }),
        docsLink: css({
            display: 'inline-block',
            color: theme.colors.text.link,
            marginTop: theme.spacing(2),
        }),
    };
}
//# sourceMappingURL=PluginsErrorsInfo.js.map