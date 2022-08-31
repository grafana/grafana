import React, { useEffect, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { QueryEditorRow } from '..';
import { SELECT_WIDTH } from '../../constants';
import CloudMonitoringDatasource from '../../datasource';
import { SLOQuery } from '../../types';

export interface Props {
  refId: string;
  onChange: (query: SLOQuery) => void;
  query: SLOQuery;
  templateVariableOptions: Array<SelectableValue<string>>;
  datasource: CloudMonitoringDatasource;
}

export const SLO = ({ refId, query, templateVariableOptions, onChange, datasource }: Props) => {
  const [slos, setSLOs] = useState<Array<SelectableValue<string>>>([]);
  const { projectName, serviceId } = query;

  useEffect(() => {
    if (!projectName || !serviceId) {
      return;
    }

    datasource.getServiceLevelObjectives(projectName, serviceId).then((sloIds: Array<SelectableValue<string>>) => {
      setSLOs([
        {
          label: 'Template Variables',
          options: templateVariableOptions,
        },
        ...sloIds,
      ]);
    });
  }, [datasource, projectName, serviceId, templateVariableOptions]);

  return (
    <QueryEditorRow label="SLO" htmlFor={`${refId}-slo`}>
      <Select
        inputId={`${refId}-slo`}
        width={SELECT_WIDTH}
        allowCustomValue
        value={query?.sloId && { value: query?.sloId, label: query?.sloName || query?.sloId }}
        placeholder="Select SLO"
        options={slos}
        onChange={async ({ value: sloId = '', label: sloName = '' }) => {
          const slos = await datasource.getServiceLevelObjectives(projectName, serviceId);
          const slo = slos.find(({ value }) => value === datasource.templateSrv.replace(sloId));
          onChange({ ...query, sloId, sloName, goal: slo?.goal });
        }}
      />
    </QueryEditorRow>
  );
};
