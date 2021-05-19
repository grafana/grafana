import React from 'react';
import { SelectableValue } from '@grafana/data';
import { Project, AliasBy, AlignmentPeriod, AlignmentPeriodLabel, QueryEditorRow } from '..';
import { AlignmentTypes, CustomMetaData, SLOQuery } from '../../types';
import CloudMonitoringDatasource from '../../datasource';
import { Selector, Service, SLO } from '.';
import { SELECT_WIDTH } from '../../constants';

export interface Props {
  customMetaData: CustomMetaData;
  variableOptionGroup: SelectableValue<string>;
  onChange: (query: SLOQuery) => void;
  onRunQuery: () => void;
  query: SLOQuery;
  datasource: CloudMonitoringDatasource;
}

export const defaultQuery: (dataSource: CloudMonitoringDatasource) => SLOQuery = (dataSource) => ({
  projectName: dataSource.getDefaultProject(),
  alignmentPeriod: 'cloud-monitoring-auto',
  perSeriesAligner: AlignmentTypes.ALIGN_MEAN,
  aliasBy: '',
  selectorName: 'select_slo_health',
  serviceId: '',
  serviceName: '',
  sloId: '',
  sloName: '',
});

export function SLOQueryEditor({
  query,
  datasource,
  onChange,
  variableOptionGroup,
  customMetaData,
}: React.PropsWithChildren<Props>) {
  return (
    <>
      <Project
        templateVariableOptions={variableOptionGroup.options}
        projectName={query.projectName}
        datasource={datasource}
        onChange={(projectName) => onChange({ ...query, projectName })}
      />
      <Service
        datasource={datasource}
        templateVariableOptions={variableOptionGroup.options}
        query={query}
        onChange={onChange}
      ></Service>
      <SLO
        datasource={datasource}
        templateVariableOptions={variableOptionGroup.options}
        query={query}
        onChange={onChange}
      ></SLO>
      <Selector
        datasource={datasource}
        templateVariableOptions={variableOptionGroup.options}
        query={query}
        onChange={onChange}
      ></Selector>

      <QueryEditorRow label="Alignment period">
        <AlignmentPeriod
          templateVariableOptions={variableOptionGroup.options}
          query={{
            ...query,
            perSeriesAligner: query.selectorName === 'select_slo_health' ? 'ALIGN_MEAN' : 'ALIGN_NEXT_OLDER',
          }}
          onChange={onChange}
          selectWidth={SELECT_WIDTH}
        />
        <AlignmentPeriodLabel datasource={datasource} customMetaData={customMetaData} />
      </QueryEditorRow>

      <AliasBy value={query.aliasBy} onChange={(aliasBy) => onChange({ ...query, aliasBy })} />
    </>
  );
}
