import { __awaiter } from "tslib";
/* eslint-disable react/display-name,@typescript-eslint/consistent-type-assertions,@typescript-eslint/no-explicit-any */
import React, { useMemo, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { PageToolbar, ToolbarButton, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { getPerconaSettings } from 'app/percona/shared/core/selectors';
import { useSelector } from 'app/types';
import { Databases } from '../../percona/shared/core';
import { FeatureLoader } from '../shared/components/Elements/FeatureLoader';
import { AddInstance } from './components/AddInstance/AddInstance';
import AddRemoteInstance from './components/AddRemoteInstance/AddRemoteInstance';
import { Messages } from './components/AddRemoteInstance/AddRemoteInstance.messages';
import AzureDiscovery from './components/AzureDiscovery/Discovery';
import Discovery from './components/Discovery/Discovery';
import { ADD_INSTANCE_FORM_NAME } from './panel.constants';
import { getStyles } from './panel.styles';
import { InstanceTypesExtra } from './panel.types';
const availableInstanceTypes = [
    InstanceTypesExtra.rds,
    InstanceTypesExtra.azure,
    Databases.postgresql,
    Databases.mysql,
    Databases.proxysql,
    Databases.mongodb,
    InstanceTypesExtra.external,
    Databases.haproxy,
];
const AddInstancePanel = () => {
    const { result: settings } = useSelector(getPerconaSettings);
    const { azureDiscoverEnabled } = settings;
    const { instanceType = '' } = useParams();
    const [selectedInstance, selectInstance] = useState({
        type: availableInstanceTypes.includes(instanceType) ? instanceType : '',
    });
    const [showSelection, setShowSelection] = useState(!instanceType);
    const [submitting, setSubmitting] = useState(false);
    const history = useHistory();
    const styles = useStyles2(getStyles);
    const handleSubmit = (submitPromise) => __awaiter(void 0, void 0, void 0, function* () {
        setSubmitting(true);
        yield submitPromise;
        setSubmitting(false);
    });
    const InstanceForm = useMemo(() => () => (React.createElement(React.Fragment, null,
        selectedInstance.type === InstanceTypesExtra.rds && (React.createElement(Discovery, { onSubmit: handleSubmit, selectInstance: selectInstance })),
        selectedInstance.type === InstanceTypesExtra.azure && (React.createElement(AzureDiscovery, { onSubmit: handleSubmit, selectInstance: selectInstance })),
        selectedInstance.type !== InstanceTypesExtra.rds && selectedInstance.type !== InstanceTypesExtra.azure && (React.createElement(AddRemoteInstance, { onSubmit: handleSubmit, instance: selectedInstance, selectInstance: selectInstance })))), [selectedInstance]);
    const submitLabel = useMemo(() => showSelection
        ? Messages.selectionStep.next
        : selectedInstance.type === InstanceTypesExtra.rds || selectedInstance.type === InstanceTypesExtra.azure
            ? Messages.configurationStep.discover
            : Messages.configurationStep.next, [showSelection, selectedInstance]);
    const handleCancel = (e) => {
        if (showSelection) {
            history.push('/inventory/services');
        }
        else {
            history.push('/add-instance');
        }
        selectInstance({ type: '' });
        setShowSelection(true);
    };
    const handleSelectInstance = (instance) => {
        history.push('/add-instance/' + instance.type);
        selectInstance(instance);
        setShowSelection(false);
    };
    return (React.createElement(Page, null,
        React.createElement(PageToolbar, { title: showSelection ? Messages.pageTitleSelection : Messages.pageTitleConfiguration, onGoBack: history.goBack },
            React.createElement(ToolbarButton, { onClick: handleCancel }, showSelection ? Messages.selectionStep.cancel : Messages.configurationStep.cancel),
            !showSelection && (React.createElement(ToolbarButton, { form: ADD_INSTANCE_FORM_NAME, disabled: submitting, variant: "primary" }, submitLabel))),
        React.createElement(Page.Contents, { className: styles.page },
            React.createElement(FeatureLoader, null, showSelection ? (React.createElement(AddInstance, { showAzure: !!azureDiscoverEnabled, selectedInstanceType: selectedInstance, onSelectInstanceType: handleSelectInstance })) : (React.createElement(InstanceForm, null))))));
};
export default AddInstancePanel;
//# sourceMappingURL=panel.js.map