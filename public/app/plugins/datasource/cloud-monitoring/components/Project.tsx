import React, { useEffect, useMemo, useState } from 'react';
import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';
import CloudMonitoringDatasource from '../datasource';
import { SELECT_WIDTH } from '../constants';
import { QueryEditorRow } from '.';

export interface Props {
  datasource: CloudMonitoringDatasource;
  onChange: (projectName: string) => void;
  templateVariableOptions: Array<SelectableValue<string>>;
  projectName: string;
}

export function Project({ projectName, datasource, onChange, templateVariableOptions }: Props) {
  const [projects, setProjects] = useState<Array<SelectableValue<string>>>([]);
  useEffect(() => {
    datasource.getProjects().then((projects) => setProjects(projects));
  }, [datasource]);

  const projectsWithTemplateVariables = useMemo(
    () => [
      projects,
      {
        label: 'Template Variables',
        options: templateVariableOptions,
      },
      ...projects,
    ],
    [projects, templateVariableOptions]
  );

  return (
    <QueryEditorRow label="Project">
      <Select
        menuShouldPortal
        width={SELECT_WIDTH}
        allowCustomValue
        formatCreateLabel={(v) => `Use project: ${v}`}
        onChange={({ value }) => onChange(value!)}
        options={projectsWithTemplateVariables}
        value={{ value: projectName, label: projectName }}
        placeholder="Select Project"
      />
    </QueryEditorRow>
  );
}
