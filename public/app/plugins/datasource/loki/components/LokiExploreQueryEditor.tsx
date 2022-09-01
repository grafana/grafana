// Libraries
import React, { memo } from 'react';

// Types
import { QueryEditorProps } from '@grafana/data';

import { LokiDatasource } from '../datasource';
import { LokiQuery, LokiOptions } from '../types';

import { LokiOptionFields } from './LokiOptionFields';
import { LokiQueryField } from './LokiQueryField';

export type Props = QueryEditorProps<LokiDatasource, LokiQuery, LokiOptions>;

export const LokiExploreQueryEditor = memo((props: Props) => {
  const { query, data, datasource, history, onChange, onRunQuery, range } = props;

  return (
    <LokiQueryField
      datasource={datasource}
      query={query}
      onChange={onChange}
      onBlur={() => {}}
      onRunQuery={onRunQuery}
      history={history}
      data={data}
      range={range}
      data-testid={testIds.editor}
      ExtraFieldElement={
        <LokiOptionFields
          lineLimitValue={query?.maxLines?.toString() || ''}
          resolution={query.resolution || 1}
          query={query}
          onRunQuery={onRunQuery}
          onChange={onChange}
        />
      }
    />
  );
});

LokiExploreQueryEditor.displayName = 'LokiExploreQueryEditor';

export const testIds = {
  editor: 'loki-editor-explore',
};
