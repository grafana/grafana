import React from 'react';
import { Project, SLOFilter, AlignmentPeriods, AliasBy } from '.';
import { SLOQuery } from '../types';
import StackdriverDatasource from '../datasource';
import { SelectableValue } from '@grafana/data';

export interface Props {
  refId: string;
  usedAlignmentPeriod: string;
  variableOptionGroup: SelectableValue<string>;
  onChange: (query: SLOQuery) => void;
  onRunQuery: () => void;
  query: SLOQuery;
  datasource: StackdriverDatasource;
}

export const defaultQuery: Partial<SLOQuery> = {
  alignmentPeriod: 'stackdriver-auto',
  perSeriesAligner: 'ALIGN_MEAN',
  slo: '',
  aliasBy: '',
};

export function SLOQueryEditor({
  refId,
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
      <SLOFilter value={query.slo} onChange={slo => onChange({ ...query, slo })} />
      <AlignmentPeriods
        templateSrv={datasource.templateSrv}
        templateVariableOptions={variableOptionGroup.options}
        alignmentPeriod={query.alignmentPeriod}
        perSeriesAligner={query.perSeriesAligner}
        usedAlignmentPeriod={usedAlignmentPeriod}
        onChange={alignmentPeriod => onChange({ ...query, alignmentPeriod })}
      />
      <AliasBy value={query.aliasBy} onChange={aliasBy => onChange({ ...query, aliasBy })} />
    </>
  );
}
