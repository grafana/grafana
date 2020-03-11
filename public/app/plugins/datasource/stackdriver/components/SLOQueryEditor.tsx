import React from 'react';
import { Project, SLOFilter, AlignmentPeriods, AliasBy } from '.';
import { SLOQuery } from '../types';
import StackdriverDatasource from '../datasource';
import { SelectableValue } from '@grafana/data';

export interface Props {
  usedAlignmentPeriod: string;
  variableOptionGroup: SelectableValue<string>;
  onChange: (query: SLOQuery) => void;
  onRunQuery: () => void;
  query: SLOQuery;
  datasource: StackdriverDatasource;
}

export const defaultQuery: SLOQuery = {
  projectName: '',
  alignmentPeriod: 'stackdriver-auto',
  aliasBy: '',
  selectorName: 'select_slo_health',
  serviceId: '',
  sloId: '',
};

export function SLOQueryEditor({
  query,
  datasource,
  onChange,
  variableOptionGroup,
  usedAlignmentPeriod,
}: React.PropsWithChildren<Props>) {
  return (
    <>
      <Project
        templateVariableOptions={variableOptionGroup.options}
        projectName={query.projectName}
        datasource={datasource}
        onChange={projectName => onChange({ ...query, projectName })}
      />
      <SLOFilter
        templateVariableOptions={variableOptionGroup.options}
        onChange={onChange}
        datasource={datasource}
        query={query}
      />
      <AlignmentPeriods
        templateSrv={datasource.templateSrv}
        templateVariableOptions={variableOptionGroup.options}
        alignmentPeriod={query.alignmentPeriod}
        perSeriesAligner={query.selectorName === 'select_slo_health' ? 'ALIGN_MEAN' : 'ALIGN_NEXT_OLDER'}
        usedAlignmentPeriod={usedAlignmentPeriod}
        onChange={alignmentPeriod => onChange({ ...query, alignmentPeriod })}
      />
      <AliasBy value={query.aliasBy} onChange={aliasBy => onChange({ ...query, aliasBy })} />
    </>
  );
}
