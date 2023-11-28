import React, { useEffect, useMemo, useState } from 'react';
import { EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';
export function Project({ refId, projectName, datasource, onChange, templateVariableOptions }) {
    const [projects, setProjects] = useState([]);
    useEffect(() => {
        datasource.getProjects().then((projects) => setProjects(projects));
    }, [datasource]);
    const projectsWithTemplateVariables = useMemo(() => [
        {
            label: 'Template Variables',
            options: templateVariableOptions,
        },
        ...projects,
    ], [projects, templateVariableOptions]);
    return (React.createElement(EditorField, { label: "Project" },
        React.createElement(Select, { width: "auto", allowCustomValue: true, formatCreateLabel: (v) => `Use project: ${v}`, onChange: ({ value }) => onChange(value), options: projectsWithTemplateVariables, value: { value: projectName, label: projectName }, placeholder: "Select Project", inputId: `${refId}-project` })));
}
//# sourceMappingURL=Project.js.map