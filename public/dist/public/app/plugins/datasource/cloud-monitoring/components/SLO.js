import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';
export const SLO = ({ refId, query, templateVariableOptions, onChange, datasource }) => {
    const [slos, setSLOs] = useState([]);
    const { projectName, serviceId } = query;
    useEffect(() => {
        if (!projectName || !serviceId) {
            return;
        }
        datasource.getServiceLevelObjectives(projectName, serviceId).then((sloIds) => {
            setSLOs([
                {
                    label: 'Template Variables',
                    options: templateVariableOptions,
                },
                ...sloIds,
            ]);
        });
    }, [datasource, projectName, serviceId, templateVariableOptions]);
    return (React.createElement(EditorField, { label: "SLO" },
        React.createElement(Select, { inputId: `${refId}-slo`, width: "auto", allowCustomValue: true, value: (query === null || query === void 0 ? void 0 : query.sloId) && { value: query === null || query === void 0 ? void 0 : query.sloId, label: (query === null || query === void 0 ? void 0 : query.sloName) || (query === null || query === void 0 ? void 0 : query.sloId) }, placeholder: "Select SLO", options: slos, onChange: ({ value: sloId = '', label: sloName = '' }) => __awaiter(void 0, void 0, void 0, function* () {
                const slos = yield datasource.getServiceLevelObjectives(projectName, serviceId);
                const slo = slos.find(({ value }) => value === datasource.templateSrv.replace(sloId));
                onChange(Object.assign(Object.assign({}, query), { sloId, sloName, goal: slo === null || slo === void 0 ? void 0 : slo.goal }));
            }) })));
};
//# sourceMappingURL=SLO.js.map