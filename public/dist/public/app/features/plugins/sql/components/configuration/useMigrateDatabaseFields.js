import { useEffect } from 'react';
import { logDebug, config } from '@grafana/runtime';
/**
 * 1. Moves the database field from the options object to jsonData.database and empties the database field.
 * 2. If max open connections, max idle connections, and auto idle are all undefined set these to default values.
 */
export function useMigrateDatabaseFields({ onOptionsChange, options, }) {
    useEffect(() => {
        const jsonData = options.jsonData;
        let newOptions = Object.assign({}, options);
        let optionsUpdated = false;
        // Migrate the database field from the column into the jsonData object
        if (options.database) {
            logDebug(`Migrating from options.database with value ${options.database} for ${options.name}`);
            newOptions.database = '';
            newOptions.jsonData = Object.assign(Object.assign({}, jsonData), { database: options.database });
            optionsUpdated = true;
        }
        // Set default values for max open connections, max idle connection,
        // and auto idle if they're all undefined
        if (jsonData.maxOpenConns === undefined &&
            jsonData.maxIdleConns === undefined &&
            jsonData.maxIdleConnsAuto === undefined) {
            const { maxOpenConns, maxIdleConns } = config.sqlConnectionLimits;
            logDebug(`Setting default max open connections to ${maxOpenConns} and setting max idle connection to ${maxIdleConns}`);
            // Spread from the jsonData in new options in case
            // the database field was migrated as well
            newOptions.jsonData = Object.assign(Object.assign({}, newOptions.jsonData), { maxOpenConns: maxOpenConns, maxIdleConns: maxIdleConns, maxIdleConnsAuto: true });
            // Make sure we issue an update if options changed
            optionsUpdated = true;
        }
        // If the maximum connection lifetime hasn't been
        // otherwise set fill in with the default from configuration
        if (jsonData.connMaxLifetime === undefined) {
            const { connMaxLifetime } = config.sqlConnectionLimits;
            // Spread new options and add our value
            newOptions.jsonData = Object.assign(Object.assign({}, newOptions.jsonData), { connMaxLifetime: connMaxLifetime });
            // Note that we've updated the options
            optionsUpdated = true;
        }
        // Only issue an update if we changed options
        if (optionsUpdated) {
            onOptionsChange(newOptions);
        }
    }, [onOptionsChange, options]);
}
//# sourceMappingURL=useMigrateDatabaseFields.js.map