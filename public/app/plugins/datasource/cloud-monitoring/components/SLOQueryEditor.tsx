import React, { useMemo } from 'react';

import { SelectableValue } from '@grafana/data';
import { EditorField, EditorFieldGroup, EditorRow } from '@grafana/experimental';

import { ALIGNMENT_PERIODS, SLO_BURN_RATE_SELECTOR_NAME } from '../constants';
import CloudMonitoringDatasource from '../datasource';
import { alignmentPeriodLabel } from '../functions';
import { AlignmentTypes, SLOQuery } from '../types/query';
import { CustomMetaData } from '../types/types';

import { AliasBy } from './AliasBy';
import { LookbackPeriodSelect } from './LookbackPeriodSelect';
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
  aliasBy?: string;
  onChangeAliasBy: (aliasBy: string) => void;
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
  lookbackPeriod: '',
});

export function SLOQueryEditor({
  refId,
  query,
  datasource,
  onChange,
  variableOptionGroup,
  customMetaData,
  aliasBy,
  onChangeAliasBy,
}: React.PropsWithChildren<Props>) {
  const alignmentLabel = useMemo(() => alignmentPeriodLabel(customMetaData, datasource), [customMetaData, datasource]);
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
        {query.selectorName === SLO_BURN_RATE_SELECTOR_NAME && (
          <LookbackPeriodSelect
            refId={refId}
            onChange={(lookbackPeriod) => onChange({ ...query, lookbackPeriod: lookbackPeriod })}
            current={query.lookbackPeriod}
            templateVariableOptions={variableOptionGroup.options}
          />
        )}

        <EditorFieldGroup>
          <EditorField label="Alignment period" tooltip={alignmentLabel}>
            <PeriodSelect
              inputId={`${refId}-alignment-period`}
              templateVariableOptions={variableOptionGroup.options}
              current={query.alignmentPeriod}
              onChange={(period) => onChange({ ...query, alignmentPeriod: period })}
              aligmentPeriods={ALIGNMENT_PERIODS}
            />
          </EditorField>
        </EditorFieldGroup>

        <AliasBy refId={refId} value={aliasBy} onChange={onChangeAliasBy} />
      </EditorRow>
    </>
  );
}
