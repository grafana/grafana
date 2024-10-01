import { ComponentType, useState } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useEffectOnce } from 'react-use';

import { DataQuery, DataSourceJsonData } from '@grafana/schema';

import { DataSourceApi, DataSourceOptionsType, DataSourceQueryType, QueryEditorProps } from '../types/datasource';

// QueryEditorSanitizer is a higher order component that can be used to wrap a QueryEditor component
// and ensure that the query is sanitized before being passed to the QueryEditor.
export function QueryEditorSanitizer<
  DSType extends DataSourceApi<TQuery, TOptions>,
  TQuery extends DataQuery = DataSourceQueryType<DSType>,
  TOptions extends DataSourceJsonData = DataSourceOptionsType<DSType>,
>(QueryEditor: ComponentType<QueryEditorProps<DSType, TQuery, TOptions>>) {
  const WithExtra = (props: QueryEditorProps<DSType, TQuery, TOptions>) => {
    const [migrated, setMigrated] = useState(false);
    useEffectOnce(() => {
      if (props.query && props.datasource.migrateQuery) {
        const migrated = props.datasource.migrateQuery(props.query);
        if (migrated instanceof Promise) {
          migrated.then((migrated) => {
            props.onChange(migrated);
            setMigrated(true);
          });
          return;
        }
        props.onChange(migrated);
      }
      setMigrated(true);
    });
    if (!migrated) {
      return <Skeleton />;
    }
    return <QueryEditor {...props} />;
  };
  return WithExtra;
}
