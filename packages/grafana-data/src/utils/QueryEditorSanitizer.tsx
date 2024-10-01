import { ComponentType, useEffect } from 'react';

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
    useEffect(() => {
      if (props.query && props.datasource.migrateQuery) {
        const migrated = props.datasource.migrateQuery(props.query);
        if (migrated instanceof Promise) {
          migrated.then((migrated) => {
            props.onChange(migrated);
          });
        } else {
          props.onChange(migrated);
        }
      }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return <QueryEditor {...props} />;
  };
  return WithExtra;
}
