import React, { useEffect } from 'react';
import { connect } from 'react-redux';
import { Form, Button, Field, Checkbox, LinkButton, HorizontalGroup, Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { loadSupportBundleCollectors, createSupportBundle } from './state/actions';
const subTitle = (React.createElement("span", null, "Choose the components for the support bundle. The support bundle will be available for 3 days after creation."));
const mapStateToProps = (state) => {
    return {
        collectors: state.supportBundles.supportBundleCollectors,
        isLoading: state.supportBundles.createBundlePageLoading,
        loadCollectorsError: state.supportBundles.loadBundlesError,
        createBundleError: state.supportBundles.createBundleError,
    };
};
const mapDispatchToProps = {
    loadSupportBundleCollectors,
    createSupportBundle,
};
const connector = connect(mapStateToProps, mapDispatchToProps);
export const SupportBundlesCreateUnconnected = ({ collectors, isLoading, loadCollectorsError, createBundleError, loadSupportBundleCollectors, createSupportBundle, }) => {
    const onSubmit = (data) => {
        const selectedLabelsArray = Object.keys(data).filter((key) => data[key]);
        createSupportBundle({ collectors: selectedLabelsArray });
    };
    useEffect(() => {
        loadSupportBundleCollectors();
    }, [loadSupportBundleCollectors]);
    // turn components into a uuid -> enabled map
    const values = collectors.reduce((acc, curr) => {
        return Object.assign(Object.assign({}, acc), { [curr.uid]: curr.default });
    }, {});
    return (React.createElement(Page, { navId: "support-bundles", pageNav: { text: 'Create support bundle' }, subTitle: subTitle },
        React.createElement(Page.Contents, { isLoading: isLoading },
            loadCollectorsError && React.createElement(Alert, { title: loadCollectorsError, severity: "error" }),
            createBundleError && React.createElement(Alert, { title: createBundleError, severity: "error" }),
            !!collectors.length && (React.createElement(Form, { defaultValues: values, onSubmit: onSubmit, validateOn: "onSubmit" }, ({ register, errors }) => {
                return (React.createElement(React.Fragment, null,
                    [...collectors]
                        .sort((a, b) => a.displayName.localeCompare(b.displayName))
                        .map((component) => {
                        return (React.createElement(Field, { key: component.uid },
                            React.createElement(Checkbox, Object.assign({}, register(component.uid), { label: component.displayName, id: component.uid, description: component.description, defaultChecked: component.default, disabled: component.includedByDefault }))));
                    }),
                    React.createElement(HorizontalGroup, null,
                        React.createElement(Button, { type: "submit" }, "Create"),
                        React.createElement(LinkButton, { href: "/support-bundles", variant: "secondary" }, "Cancel"))));
            })))));
};
export default connector(SupportBundlesCreateUnconnected);
//# sourceMappingURL=SupportBundlesCreate.js.map