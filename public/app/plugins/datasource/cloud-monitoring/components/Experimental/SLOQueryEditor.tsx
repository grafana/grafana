import React from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorRow, EditorFieldGroup, EditorField, Stack } from '@grafana/ui';

import { ALIGNMENT_PERIODS } from '../../constants';
import CloudMonitoringDatasource from '../../datasource';
import { AlignmentTypes, CustomMetaData, SLOQuery } from '../../types';

import { AliasBy } from './AliasBy';
import { AlignmentPeriodLabel } from './AlignmentPeriodLabel';
import { PeriodSelect } from './PeriodSelect';
import { Project } from './Project';
import { SLO } from './SLO';
import { Selector } from './Selector';
import { Service } from './Service';

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
      <EditorRow>
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

        <EditorFieldGroup>
          <EditorField label="Alignment period">
            <PeriodSelect
              inputId={`${refId}-alignment-period`}
              templateVariableOptions={variableOptionGroup.options}
              current={query.alignmentPeriod}
              onChange={(period) => onChange({ ...query, alignmentPeriod: period })}
              aligmentPeriods={ALIGNMENT_PERIODS}
            />
          </EditorField>
          <Stack alignItems="flex-end">
            <AlignmentPeriodLabel datasource={datasource} customMetaData={customMetaData} />
          </Stack>
        </EditorFieldGroup>

        <AliasBy refId={refId} value={query.aliasBy} onChange={(aliasBy) => onChange({ ...query, aliasBy })} />
      </EditorRow>
    </>
  );
}
