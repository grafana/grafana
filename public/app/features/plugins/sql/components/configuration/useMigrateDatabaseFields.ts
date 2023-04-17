import { useEffect } from 'react';

import { DataSourcePluginOptionsEditorProps } from '@grafana/data';
import { logDebug, getBackendSrv } from '@grafana/runtime';

import { SQLOptions } from '../../types';

/**
 * 1. Moves the database field from the options object to jsonData.database and empties the database field.
 * 2. If max open connections, max idle connections, and auto idle are all undefined set these to default values.
 */
export function useMigrateDatabaseFields<T extends SQLOptions, S = {}>({
  onOptionsChange,
  options,
}: DataSourcePluginOptionsEditorProps<T, S>) {
  useEffect(() => {
    const jsonData = options.jsonData;
    let newOptions = { ...options };
    let optionsUpdated = false;

    const updateData = async () => {
      const settings = await getBackendSrv().get('/api/frontend/settings');
      const { sqlConnectionLimits } = settings;
      console.log(jsonData);

      // Migrate the database field from the column into the jsonData object
      if (options.database) {
        logDebug(`Migrating from options.database with value ${options.database} for ${options.name}`);
        newOptions.database = '';
        newOptions.jsonData = { ...jsonData, database: options.database };
        optionsUpdated = true;
      }

      // Set default values for max open connections, max idle connection,
      // and auto idle if they're all undefined
      if (
        jsonData.maxOpenConns === undefined &&
        jsonData.maxIdleConns === undefined &&
        jsonData.maxIdleConnsAuto === undefined
      ) {
        const { maxOpenConns, maxIdleConns } = sqlConnectionLimits;

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

        // Make sure we issue an update if options changed
        optionsUpdated = true;
      }

      // If the maximum connection lifetime hasn't been
      // otherwise set fill in with the default from configuration
      if (jsonData.connMaxLifetime === undefined) {
        const { connMaxLifetime } = sqlConnectionLimits;

        // Spread new options and add our value
        newOptions.jsonData = {
          ...newOptions.jsonData,
          connMaxLifetime: connMaxLifetime,
        };

        // Note that we've updated the options
        optionsUpdated = true;
      }

      // Only issue an update if we changed options
      if (optionsUpdated) {
        onOptionsChange(newOptions);
      }
    };

    updateData();
  }, [onOptionsChange, options]);
}
