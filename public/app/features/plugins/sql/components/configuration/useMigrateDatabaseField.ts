import { useEffect } from 'react';

import { DataSourceJsonData, DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { logDebug } from '@grafana/runtime';

import { SQLOptions } from '../../types';

/**
 * Moves the database field from the options object to jsonData.database and empties the database field.
 */
export function useMigrateDatabaseField<T extends DataSourceJsonData = SQLOptions, S = {}>({
  onOptionsChange,
  options,
}: DataSourcePluginOptionsEditorProps<T, S>) {
  useEffect(() => {
    if (options.database) {
      logDebug(`Migrating from options.database with value ${options.database} for ${options.name}`);
      onOptionsChange({
        ...options,
        database: '',
        jsonData: { ...options.jsonData, database: options.database },
      });
    }
  }, [onOptionsChange, options]);
}
