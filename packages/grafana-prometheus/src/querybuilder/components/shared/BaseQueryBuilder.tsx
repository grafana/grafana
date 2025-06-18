import { memo } from 'react';

import { NestedQueryList } from '../NestedQueryList';

import { BaseQueryBuilderProps } from './BaseQueryBuilderProps';
import { QueryBuilderContent } from './QueryBuilderContent';

export const BaseQueryBuilder = memo<BaseQueryBuilderProps>((props) => {
  const { query, datasource, onChange, onRunQuery, showExplain } = props;

  return (
    <>
      <QueryBuilderContent {...props} />
      {query.binaryQueries && query.binaryQueries.length > 0 && (
        <NestedQueryList
          query={query}
          datasource={datasource}
          onChange={onChange}
          onRunQuery={onRunQuery}
          showExplain={showExplain}
        />
      )}
    </>
  );
});

BaseQueryBuilder.displayName = 'BaseQueryBuilder';
