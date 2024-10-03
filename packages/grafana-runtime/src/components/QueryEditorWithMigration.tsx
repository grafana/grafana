import React, { useEffect, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useEffectOnce } from 'react-use';

import { DataSourceOptionsType, DataSourceQueryType, QueryEditorProps } from '@grafana/data';
import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { DataSourceWithBackendMigration } from '../utils/DataSourceWithBackendMigration';

// QueryEditorWithMigration is a higher order component that can be used to wrap a QueryEditor component
// and ensure that the query is migrated before being passed to the QueryEditor.
export function QueryEditorWithMigration<
  DSType extends DataSourceWithBackendMigration<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>,
>(QueryEditor: React.ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>) {
  const WithExtra = (props: QueryEditorProps<DSType, TQuery, TOptions>) => {
    const [migrated, setMigrated] = useState(false);
    const [query, setQuery] = useState(props.query);
    useEffectOnce(() => {
      if (props.query) {
        const migrated = props.datasource.migrateQuery(props.query);
        if (migrated instanceof Promise) {
          migrated.then((migrated) => {
            props.onChange(migrated);
            setQuery(migrated);
            setMigrated(true);
          });
          return;
        }
        props.onChange(migrated);
      }
      setMigrated(true);
    });
    useEffect(() => {
      setQuery(props.query);
    }, [props.query]);

    if (!migrated) {
      return <Skeleton />;
    }
    return <QueryEditor {...props} query={query} />;
  };
  return WithExtra;
}
