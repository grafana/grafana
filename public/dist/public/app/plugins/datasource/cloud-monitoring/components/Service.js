import React, { useEffect, useState } from 'react';
import { EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';
export const Service = ({ refId, query, templateVariableOptions, onChange, datasource }) => {
    const [services, setServices] = useState([]);
    const { projectName } = query;
    useEffect(() => {
        if (!projectName) {
            return;
        }
        datasource.getSLOServices(projectName).then((services) => {
            setServices([
                {
                    label: 'Template Variables',
                    options: templateVariableOptions,
                },
                ...services,
            ]);
        });
    }, [datasource, projectName, templateVariableOptions]);
    return (React.createElement(EditorField, { label: "Service" },
        React.createElement(Select, { inputId: `${refId}-slo-service`, width: "auto", allowCustomValue: true, value: (query === null || query === void 0 ? void 0 : query.serviceId) && { value: query === null || query === void 0 ? void 0 : query.serviceId, label: (query === null || query === void 0 ? void 0 : query.serviceName) || (query === null || query === void 0 ? void 0 : query.serviceId) }, placeholder: "Select service", options: services, onChange: ({ value: serviceId = '', label: serviceName = '' }) => onChange(Object.assign(Object.assign({}, query), { serviceId, serviceName, sloId: '' })) })));
};
//# sourceMappingURL=Service.js.map