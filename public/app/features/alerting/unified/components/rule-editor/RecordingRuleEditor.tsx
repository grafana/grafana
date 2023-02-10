import { noop } from 'lodash';
import React, { FC, useCallback } from 'react';

import { PanelData, DataSourceInstanceSettings } from '@grafana/data';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { useRulesSourcesWithRuler } from '../../hooks/useRuleSourcesWithRuler';

import { QueryEditor } from './QueryEditor';

export interface RecordingRuleEditorProps {
  queries: AlertQuery[];
  onChangeQuery: (updatedQueries: AlertQuery[]) => void;
  runQueries: (queries: AlertQuery[]) => void;
  panelData: Record<string, PanelData>;
}

export const RecordingRuleEditor: FC<RecordingRuleEditorProps> = ({
  queries,
  onChangeQuery,
  runQueries,
  panelData,
}) => {
  const rulesSourcesWithRuler = useRulesSourcesWithRuler();

  const dataSourceFilter = useCallback(
    (ds: DataSourceInstanceSettings): boolean => {
      return !!rulesSourcesWithRuler.find(({ id }) => id === ds.id);
    },
    [rulesSourcesWithRuler]
  );

  return (
    <QueryEditor
      queries={queries}
      expressions={[]}
      onRunQueries={() => runQueries(queries)}
      onChangeQueries={onChangeQuery}
      onDuplicateQuery={noop}
      panelData={panelData}
      condition={'A'}
      onSetCondition={noop}
      filter={dataSourceFilter}
      renderHeaderExtras={false}
      renderActions={false}
    />
  );
};
