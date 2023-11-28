import { __awaiter } from "tslib";
import React, { useCallback, useMemo, useState } from 'react';
import { Form as FormFinal } from 'react-final-form';
import { AppEvents } from '@grafana/data';
import { useStyles } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { Databases } from 'app/percona/shared/core';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { ADD_INSTANCE_FORM_NAME } from '../../panel.constants';
import { InstanceTypesExtra, INSTANCE_TYPES_LABELS } from '../../panel.types';
import { ADD_AZURE_CANCEL_TOKEN, ADD_RDS_CANCEL_TOKEN } from './AddRemoteInstance.constants';
import { Messages } from './AddRemoteInstance.messages';
import AddRemoteInstanceService, { toPayload } from './AddRemoteInstance.service';
import { getStyles } from './AddRemoteInstance.styles';
import { getInstanceData, remoteToken } from './AddRemoteInstance.tools';
import { TrackingOptions, } from './AddRemoteInstance.types';
import { AdditionalOptions, Labels, MainDetails, MongoDBConnectionDetails, MySQLConnectionDetails, PostgreSQLConnectionDetails, } from './FormParts';
import { ExternalServiceConnectionDetails } from './FormParts/ExternalServiceConnectionDetails/ExternalServiceConnectionDetails';
import { HAProxyConnectionDetails } from './FormParts/HAProxyConnectionDetails/HAProxyConnectionDetails';
const AddRemoteInstance = ({ instance: { type, credentials }, onSubmit: submitWrapper, }) => {
    const styles = useStyles(getStyles);
    const { remoteInstanceCredentials, discoverName } = getInstanceData(type, credentials);
    const [loading, setLoading] = useState(false);
    const [generateToken] = useCancelToken();
    const initialValues = Object.assign({}, remoteInstanceCredentials);
    if (type === Databases.mysql) {
        initialValues.qan_mysql_perfschema = true;
        initialValues.disable_comments_parsing = true;
    }
    if (type === Databases.postgresql) {
        initialValues.tracking = TrackingOptions.pgStatements;
        initialValues.disable_comments_parsing = true;
    }
    const onSubmit = useCallback((values) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            setLoading(true);
            if (values.isRDS) {
                yield AddRemoteInstanceService.addRDS(toPayload(values, discoverName), generateToken(ADD_RDS_CANCEL_TOKEN));
            }
            else if (values.isAzure) {
                yield AddRemoteInstanceService.addAzure(toPayload(values, discoverName), generateToken(ADD_AZURE_CANCEL_TOKEN));
            }
            else {
                yield AddRemoteInstanceService.addRemote(type, values, generateToken(remoteToken(type)));
            }
            appEvents.emit(AppEvents.alertSuccess, [
                Messages.success.title(values.serviceName || values.address || ''),
                Messages.success.description(INSTANCE_TYPES_LABELS[type]),
            ]);
            window.location.href = '/graph/inventory/';
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setLoading(false);
    }), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, discoverName]);
    const ConnectionDetails = useCallback(({ form, type }) => {
        switch (type) {
            case InstanceTypesExtra.external:
                return React.createElement(ExternalServiceConnectionDetails, { form: form });
            case Databases.haproxy:
                return React.createElement(HAProxyConnectionDetails, { form: form, remoteInstanceCredentials: remoteInstanceCredentials });
            case Databases.postgresql:
                return React.createElement(PostgreSQLConnectionDetails, { form: form, remoteInstanceCredentials: remoteInstanceCredentials });
            case Databases.mongodb:
                return React.createElement(MongoDBConnectionDetails, { form: form, remoteInstanceCredentials: remoteInstanceCredentials });
            case Databases.mysql:
                return React.createElement(MySQLConnectionDetails, { form: form, remoteInstanceCredentials: remoteInstanceCredentials });
            default:
                return React.createElement(MainDetails, { form: form, remoteInstanceCredentials: remoteInstanceCredentials });
        }
    }, [remoteInstanceCredentials]);
    const formParts = useMemo(() => (form) => (React.createElement(React.Fragment, null,
        React.createElement(ConnectionDetails, { form: form, type: type }),
        React.createElement(Labels, null),
        type !== InstanceTypesExtra.external && (React.createElement(AdditionalOptions, { remoteInstanceCredentials: remoteInstanceCredentials, loading: loading, instanceType: type, form: form })))), [ConnectionDetails, loading, remoteInstanceCredentials, type]);
    const getHeader = (databaseType) => {
        if (databaseType === InstanceTypesExtra.external) {
            return Messages.form.titles.addExternalService;
        }
        if (databaseType === '') {
            return Messages.form.titles.addRemoteInstance;
        }
        return `Configuring ${INSTANCE_TYPES_LABELS[databaseType]} service`;
    };
    return (React.createElement("div", { className: styles.formWrapper },
        React.createElement(FormFinal, { onSubmit: (values) => submitWrapper(onSubmit(values)), initialValues: initialValues, mutators: {
                setValue: ([field, value], state, { changeValue }) => {
                    changeValue(state, field, () => value);
                },
            }, render: ({ form, handleSubmit }) => (React.createElement("form", { id: ADD_INSTANCE_FORM_NAME, onSubmit: handleSubmit, "data-testid": "add-remote-instance-form" },
                React.createElement("h3", { className: styles.addRemoteInstanceTitle }, getHeader(type)),
                formParts(form))) })));
};
export default AddRemoteInstance;
//# sourceMappingURL=AddRemoteInstance.js.map