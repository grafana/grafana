import React from 'react';
import { Segment, SegmentAsync } from '@grafana/ui';
import { SelectableValue } from '@grafana/data';
import { selectors } from '../constants';
import { Project, AlignmentPeriods, AliasBy, QueryInlineField } from '.';
import { SLOQuery } from '../types';
import StackdriverDatasource from '../datasource';

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
      <QueryInlineField label="Service">
        <SegmentAsync
          allowCustomValue
          value={query?.serviceId}
          placeholder="Select service"
          loadOptions={() =>
            datasource.getSLOServices(query.projectName).then(services => [
              {
                label: 'Template Variables',
                options: variableOptionGroup.options,
              },
              ...services,
            ])
          }
          onChange={({ value: serviceId = '' }) => onChange({ ...query, serviceId, sloId: '' })}
        />
      </QueryInlineField>

      <QueryInlineField label="SLO">
        <SegmentAsync
          allowCustomValue
          value={query?.sloId}
          placeholder="Select SLO"
          loadOptions={() =>
            datasource.getServiceLevelObjectives(query.projectName, query.serviceId).then(sloIds => [
              {
                label: 'Template Variables',
                options: variableOptionGroup.options,
              },
              ...sloIds,
            ])
          }
          onChange={({ value: sloId = '' }) => onChange({ ...query, sloId })}
        />
      </QueryInlineField>

      <QueryInlineField label="Selector">
        <Segment
          allowCustomValue
          value={[...selectors, ...variableOptionGroup.options].find(s => s.value === query?.selectorName ?? '')}
          options={[
            {
              label: 'Template Variables',
              options: variableOptionGroup.options,
            },
            ...selectors,
          ]}
          onChange={({ value: selectorName }) => onChange({ ...query, selectorName })}
        />
      </QueryInlineField>

      <AlignmentPeriods
        templateSrv={datasource.templateSrv}
        templateVariableOptions={variableOptionGroup.options}
        alignmentPeriod={query.alignmentPeriod || ''}
        perSeriesAligner={query.selectorName === 'select_slo_health' ? 'ALIGN_MEAN' : 'ALIGN_NEXT_OLDER'}
        usedAlignmentPeriod={usedAlignmentPeriod}
        onChange={alignmentPeriod => onChange({ ...query, alignmentPeriod })}
      />
      <AliasBy value={query.aliasBy} onChange={aliasBy => onChange({ ...query, aliasBy })} />
    </>
  );
}
