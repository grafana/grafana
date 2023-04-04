import { useEffect } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { logDebug } from '@grafana/runtime';

import { SQLConnectionDefaults } from '../../constants';
import { SQLOptions } from '../../types';

/**
 * 1. Moves the database field from the options object to jsonData.database and empties the database field.
 * 2. If max open connections, max idle connections, and auto idle are all undefined set these to default values.
 */
export function useMigrateDatabaseField<T extends SQLOptions, S = {}>({
  onOptionsChange,
  options,
}: DataSourcePluginOptionsEditorProps<T, S>) {
  useEffect(() => {
    const jsonData = options.jsonData;
    const newOptions = { ...options };

    if (options.database) {
      logDebug(`Migrating from options.database with value ${options.database} for ${options.name}`);
      newOptions.database = '';
      newOptions.jsonData = { ...jsonData, database: options.database };
    }

    // Set default values for max open connections, max idle connection,
    // and auto idle if they're all undefined
    if (
      jsonData.maxOpenConns === undefined &&
      jsonData.maxIdleConns === undefined &&
      jsonData.maxIdleConnsAuto === undefined
    ) {
      // It's expected that the default will be greater than 4
      const maxOpenConns = SQLConnectionDefaults.MAX_CONNS;
      const maxIdleConns = Math.ceil(maxOpenConns / 2);

      logDebug(
        `Setting default max open connections to ${maxOpenConns} and setting max idle connection to ${maxIdleConns}`
      );

      // Spread from the jsonData in new options in case
      // the database field was migrated as well
      newOptions.jsonData = {
        ...newOptions.jsonData,
        maxOpenConns: maxOpenConns,
        maxIdleConns: maxIdleConns,
        maxIdleConnsAuto: true,
      };
    }

    onOptionsChange(newOptions);
  }, [onOptionsChange, options]);
}
