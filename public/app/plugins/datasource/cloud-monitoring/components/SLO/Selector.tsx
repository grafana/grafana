import React from 'react';

import { SelectableValue } from '@grafana/data';
import { Select } from '@grafana/ui';

import { QueryEditorRow } from '..';
import { SELECT_WIDTH, SELECTORS } from '../../constants';
import CloudMonitoringDatasource from '../../datasource';
import { SLOQuery } from '../../types';

export interface Props {
  refId: string;
  onChange: (query: SLOQuery) => void;
  query: SLOQuery;
  templateVariableOptions: Array<SelectableValue<string>>;
  datasource: CloudMonitoringDatasource;
}

export const Selector: React.FC<Props> = ({ refId, query, templateVariableOptions, onChange, datasource }) => {
  return (
    <QueryEditorRow label="Selector" htmlFor={`${refId}-slo-selector`}>
      <Select
        menuShouldPortal
        inputId={`${refId}-slo-selector`}
        width={SELECT_WIDTH}
        allowCustomValue
        value={[...SELECTORS, ...templateVariableOptions].find((s) => s.value === query?.selectorName ?? '')}
        options={[
          {
            label: 'Template Variables',
            options: templateVariableOptions,
          },
          ...SELECTORS,
        ]}
        onChange={({ value: selectorName }) => onChange({ ...query, selectorName: selectorName ?? '' })}
      />
    </QueryEditorRow>
  );
};
