import { useEffect } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { logDebug } from '@grafana/runtime';

import { SQLOptions } from '../../types';

/**
 * Moves the database field from the options object to jsonData.database and empties the database field.
 */
export function useMigrateDatabaseField<T extends SQLOptions, S = {}>({
  onOptionsChange,
  options,
}: DataSourcePluginOptionsEditorProps<T, S>) {
  useEffect(() => {
    const jsonData = options.jsonData;

    if (options.database) {
      logDebug(`Migrating from options.database with value ${options.database} for ${options.name}`);
      onOptionsChange({
        ...options,
        database: '',
        jsonData: { ...options.jsonData, database: options.database },
      });
    }

    if (
      jsonData.maxOpenConns === undefined &&
      jsonData.maxIdleConns === undefined &&
      jsonData.maxIdleConnsAuto === undefined
    ) {
      // logDebug(`Setting default max open connections to ${} and setting max idle connection to ${}`);

      onOptionsChange({
        ...options,
        jsonData: {
          ...jsonData,
          maxOpenConns: 100,
          maxIdleConns: 50,
          maxIdleConnsAuto: true,
        },
      });
    }

    // const ret = onOptionsChange({...options});
    // console.log(ret);
  }, [onOptionsChange, options]);
}
