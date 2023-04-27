import React, { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField } from '@grafana/experimental';
import { Select } from '@grafana/ui';

import CloudMonitoringDatasource from '../datasource';

export interface Props {
  refId: string;
  datasource: CloudMonitoringDatasource;
  onChange: (projectName: string) => void;
  templateVariableOptions: Array<SelectableValue<string>>;
  projectName: string;
}

export function Project({ refId, projectName, datasource, onChange, templateVariableOptions }: Props) {
  const [projects, setProjects] = useState<Array<SelectableValue<string>>>([]);
  useEffect(() => {
    datasource.getProjects().then((projects) => setProjects(projects));
  }, [datasource]);

  const projectsWithTemplateVariables = useMemo(
    () => [
      {
        label: 'Template Variables',
        options: templateVariableOptions,
      },
      ...projects,
    ],
    [projects, templateVariableOptions]
  );

  return (
    <EditorField label="Project">
      <Select
        width="auto"
        allowCustomValue
        formatCreateLabel={(v) => `Use project: ${v}`}
        onChange={({ value }) => onChange(value!)}
        options={projectsWithTemplateVariables}
        value={{ value: projectName, label: projectName }}
        placeholder="Select Project"
        inputId={`${refId}-project`}
      />
    </EditorField>
  );
}
