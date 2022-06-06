import React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRow, EditorField, Stack } from '@grafana/experimental';

import { AliasBy, PeriodSelect, AlignmentPeriodLabel, Project } from '..';
import { ALIGNMENT_PERIODS, SELECT_WIDTH } from '../../constants';
import CloudMonitoringDatasource from '../../datasource';
import { AlignmentTypes, CustomMetaData, SLOQuery } from '../../types';

import { Selector, Service, SLO } from '.';

export interface Props {
  refId: string;
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
  refId,
  query,
  datasource,
  onChange,
  variableOptionGroup,
  customMetaData,
}: React.PropsWithChildren<Props>) {
  return (
    <>
      <Project
        refId={refId}
        templateVariableOptions={variableOptionGroup.options}
        projectName={query.projectName}
        datasource={datasource}
        onChange={(projectName) => onChange({ ...query, projectName })}
      />
      <Service
        refId={refId}
        datasource={datasource}
        templateVariableOptions={variableOptionGroup.options}
        query={query}
        onChange={onChange}
      />
      <SLO
        refId={refId}
        datasource={datasource}
        templateVariableOptions={variableOptionGroup.options}
        query={query}
        onChange={onChange}
      />
      <Selector
        refId={refId}
        datasource={datasource}
        templateVariableOptions={variableOptionGroup.options}
        query={query}
        onChange={onChange}
      />

      <EditorRow>
        <EditorField label="Alignment period" htmlFor={`${refId}-alignment-period`}>
          <PeriodSelect
            inputId={`${refId}-alignment-period`}
            templateVariableOptions={variableOptionGroup.options}
            selectWidth={SELECT_WIDTH}
            current={query.alignmentPeriod}
            onChange={(period) => onChange({ ...query, alignmentPeriod: period })}
            aligmentPeriods={ALIGNMENT_PERIODS}
          />
        </EditorField>
        <Stack alignItems="flex-end">
          <AlignmentPeriodLabel datasource={datasource} customMetaData={customMetaData} />
        </Stack>
      </EditorRow>

      <AliasBy refId={refId} value={query.aliasBy} onChange={(aliasBy) => onChange({ ...query, aliasBy })} />
    </>
  );
}
