import React from 'react';
import { ConfigSubSection } from '@grafana/experimental';
import { Input, InlineField } from '@grafana/ui';
import { ConfigDescriptionLink } from 'app/core/components/ConfigDescriptionLink';
export const LogsConfig = (props) => {
    const { value, onChange } = props;
    const changeHandler = (key) => (event) => {
        onChange(Object.assign(Object.assign({}, value), { [key]: event.currentTarget.value }));
    };
    return (React.createElement(ConfigSubSection, { title: "Logs", description: React.createElement(ConfigDescriptionLink, { description: "Configure which fields the data source uses for log messages and log levels.", suffix: "elasticsearch/#logs", feature: "Elasticsearch log fields" }) },
        React.createElement(InlineField, { label: "Message field name", labelWidth: 22, tooltip: "Configure the field to be used for log messages." },
            React.createElement(Input, { id: "es_logs-config_logMessageField", value: value.logMessageField, onChange: changeHandler('logMessageField'), placeholder: "_source", width: 24 })),
        React.createElement(InlineField, { label: "Level field name", labelWidth: 22, tooltip: "Configure the field that determines the level of each log message." },
            React.createElement(Input, { id: "es_logs-config_logLevelField", value: value.logLevelField, onChange: changeHandler('logLevelField'), width: 24 }))));
};
//# sourceMappingURL=LogsConfig.js.map