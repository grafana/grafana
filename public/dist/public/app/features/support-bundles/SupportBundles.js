import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { dateTimeFormat } from '@grafana/data';
import { LinkButton, Spinner, IconButton } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { AccessControlAction } from 'app/types';
import { loadBundles, removeBundle, checkBundles } from './state/actions';
const subTitle = (React.createElement("span", null, "Support bundles allow you to easily collect and share Grafana logs, configuration, and data with the Grafana Labs team."));
const NewBundleButton = (React.createElement(LinkButton, { icon: "plus", href: "support-bundles/create", variant: "primary" }, "New support bundle"));
const mapStateToProps = (state) => {
    return {
        supportBundles: state.supportBundles.supportBundles,
        isLoading: state.supportBundles.isLoading,
    };
};
const mapDispatchToProps = {
    loadBundles,
    removeBundle,
    checkBundles,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
const SupportBundlesUnconnected = ({ supportBundles, isLoading, loadBundles, removeBundle, checkBundles }) => {
    const isPending = supportBundles.some((b) => b.state === 'pending');
    useEffect(() => {
        loadBundles();
    }, [loadBundles]);
    useEffect(() => {
        if (isPending) {
            checkBundles();
        }
    });
    const hasAccess = contextSrv.hasPermission(AccessControlAction.ActionSupportBundlesCreate);
    const hasDeleteAccess = contextSrv.hasPermission(AccessControlAction.ActionSupportBundlesDelete);
    const actions = hasAccess ? NewBundleButton : undefined;
    return (React.createElement(Page, { navId: "support-bundles", subTitle: subTitle, actions: actions },
        React.createElement(Page.Contents, { isLoading: isLoading },
            React.createElement("table", { className: "filter-table form-inline" },
                React.createElement("thead", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Created on"),
                        React.createElement("th", null, "Requested by"),
                        React.createElement("th", null, "Expires"),
                        React.createElement("th", { style: { width: '32px' } }),
                        React.createElement("th", { style: { width: '1%' } }),
                        React.createElement("th", { style: { width: '1%' } }))),
                React.createElement("tbody", null, supportBundles === null || supportBundles === void 0 ? void 0 : supportBundles.map((bundle) => (React.createElement("tr", { key: bundle.uid },
                    React.createElement("th", null, dateTimeFormat(bundle.createdAt * 1000)),
                    React.createElement("th", null, bundle.creator),
                    React.createElement("th", null, dateTimeFormat(bundle.expiresAt * 1000)),
                    React.createElement("th", null, bundle.state === 'pending' && React.createElement(Spinner, null)),
                    React.createElement("th", null,
                        React.createElement(LinkButton, { fill: "outline", disabled: bundle.state !== 'complete', target: '_self', href: `/api/support-bundles/${bundle.uid}` }, "Download")),
                    React.createElement("th", null, hasDeleteAccess && (React.createElement(IconButton, { onClick: () => removeBundle(bundle.uid), name: "trash-alt", variant: "destructive", tooltip: "Remove bundle" })))))))))));
};
export default connector(SupportBundlesUnconnected);
//# sourceMappingURL=SupportBundles.js.map