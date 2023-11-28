import React, { useEffect, useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { CheckboxField } from 'app/percona/shared/components/Elements/Checkbox';
import { NumberInputField } from 'app/percona/shared/components/Form/NumberInput';
import { RadioButtonGroupField } from 'app/percona/shared/components/Form/RadioButtonGroup';
import { Databases } from 'app/percona/shared/core';
import { validators as platformCoreValidators } from 'app/percona/shared/helpers/validatorsForm';
import { rdsTrackingOptions, trackingOptions } from '../FormParts.constants';
import { Messages } from '../FormParts.messages';
import { getStyles } from '../FormParts.styles';
import { tablestatOptions } from './AdditionalOptions.constants';
import { TablestatOptionsInterface } from './AdditionalOptions.types';
import { MongodbTLSCertificate } from './MongodbTLSCertificate';
import { MysqlTLSCertificate } from './MysqlTLSCertificate';
import { PostgreTLSCertificate } from './PostgreTLSCertificate';
export const AdditionalOptionsFormPart = ({ instanceType, remoteInstanceCredentials, form, }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("div", { className: styles.groupWrapper },
        React.createElement("h4", { className: styles.sectionHeader }, Messages.form.titles.additionalOptions),
        React.createElement("div", { className: styles.additionalOptions },
            React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.skipConnectionCheck, name: "skip_connection_check" }),
            getAdditionalOptions(instanceType, remoteInstanceCredentials, form))));
};
export const PostgreSQLAdditionalOptions = ({ isRDS, isAzure }) => (React.createElement(React.Fragment, null,
    React.createElement("h4", null, Messages.form.labels.trackingOptions),
    React.createElement(RadioButtonGroupField, { name: "tracking", "data-testid": "tracking-options-radio-button-group", options: isRDS || isAzure ? rdsTrackingOptions : trackingOptions })));
const getTablestatValues = (type) => {
    switch (type) {
        case TablestatOptionsInterface.disabled:
            return -1;
        default:
            return 1000;
    }
};
const MySQLOptions = ({ form }) => {
    const selectedOption = form.getState().values && form.getState().values.tablestatOptions;
    const [selectedValue, setSelectedValue] = useState(selectedOption || TablestatOptionsInterface.disabled);
    const styles = useStyles2(getStyles);
    useEffect(() => {
        setSelectedValue(selectedOption);
        form.change('tablestats_group_table_limit', getTablestatValues(selectedOption));
    }, [selectedOption, form]);
    return (React.createElement(React.Fragment, null,
        React.createElement("h4", null, Messages.form.labels.additionalOptions.tablestatOptions),
        React.createElement("div", { className: styles.group },
            React.createElement(RadioButtonGroupField, { name: "tablestatOptions", "data-testid": "tablestat-options-radio-button-group", defaultValue: selectedValue, options: tablestatOptions, className: styles.radioField, label: Messages.form.labels.additionalOptions.tablestatOptionsState, fullWidth: true }),
            React.createElement(NumberInputField, { name: "tablestats_group_table_limit", defaultValue: -1, disabled: selectedValue !== TablestatOptionsInterface.custom, validate: platformCoreValidators.containsNumber, label: Messages.form.labels.additionalOptions.tablestatOptionsLimit }))));
};
export const getAdditionalOptions = (type, remoteInstanceCredentials, form) => {
    switch (type) {
        case Databases.postgresql:
            return (React.createElement(React.Fragment, null,
                React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.tls, name: "tls" }),
                React.createElement(PostgreTLSCertificate, { form: form }),
                React.createElement(React.Fragment, null,
                    React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.tlsSkipVerify, name: "tls_skip_verify" }),
                    React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.disableCommentsParsing, name: "disable_comments_parsing" })),
                React.createElement(PostgreSQLAdditionalOptions, { isRDS: remoteInstanceCredentials.isRDS, isAzure: remoteInstanceCredentials.isAzure }),
                remoteInstanceCredentials.isRDS ? (React.createElement(React.Fragment, null,
                    React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.disableBasicMetrics, name: "disable_basic_metrics" }),
                    React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.disableEnchancedMetrics, name: "disable_enhanced_metrics" }))) : null,
                remoteInstanceCredentials.isAzure ? (React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.azureDatabaseExporter, name: "azure_database_exporter" })) : null));
        case Databases.mysql:
            return (React.createElement(React.Fragment, null,
                React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.tls, name: "tls" }),
                React.createElement(MysqlTLSCertificate, { form: form }),
                React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.tlsSkipVerify, name: "tls_skip_verify" }),
                React.createElement(MySQLOptions, { form: form }),
                React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.disableCommentsParsing, name: "disable_comments_parsing" }),
                React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.qanMysqlPerfschema, name: "qan_mysql_perfschema" }),
                remoteInstanceCredentials.isRDS ? (React.createElement(React.Fragment, null,
                    React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.disableBasicMetrics, name: "disable_basic_metrics" }),
                    React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.disableEnchancedMetrics, name: "disable_enhanced_metrics" }))) : null,
                remoteInstanceCredentials.isAzure ? (React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.azureDatabaseExporter, name: "azure_database_exporter" })) : null));
        case Databases.mongodb:
            return (React.createElement(React.Fragment, null,
                React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.tls, name: "tls" }),
                React.createElement(MongodbTLSCertificate, { form: form }),
                React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.tlsSkipVerify, name: "tls_skip_verify" }),
                React.createElement(CheckboxField, { name: "qan_mongodb_profiler", "data-testid": "qan-mongodb-profiler-checkbox", label: Messages.form.labels.additionalOptions.qanMongodbProfiler })));
        case Databases.haproxy:
            return null;
        default:
            return (React.createElement(React.Fragment, null,
                React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.tls, name: "tls" }),
                React.createElement(CheckboxField, { label: Messages.form.labels.additionalOptions.tlsSkipVerify, name: "tls_skip_verify" })));
    }
};
//# sourceMappingURL=AdditionalOptions.js.map