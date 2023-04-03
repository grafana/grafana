export const COMMON_AGGREGATE_FNS = ['AVG', 'COUNT', 'MAX', 'MIN', 'SUM'];

export const MACRO_NAMES = [
  '$__time',
  '$__timeEpoch',
  '$__timeFilter',
  '$__timeFrom',
  '$__timeTo',
  '$__timeGroup',
  '$__timeGroupAlias',
  '$__unixEpochFilter',
  '$__unixEpochNanoFilter',
  '$__unixEpochNanoFrom',
  '$__unixEpochNanoTo',
  '$__unixEpochGroup',
  '$__unixEpochGroupAlias',
];

/**
 * Constants for SQL connection
 * parameters and automatic settings
 */
export const SQLConnectionDefaults = {
  AUTO_IDLE_MIN: 2,
  AUTO_IDLE_THRESHOLD: 4,
  MAX_CONNS: 100,
};
