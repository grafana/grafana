import { SupplementaryQueryType } from '@grafana/data';
import store from 'app/core/store';
import { SupplementaryQueries } from 'app/types';

export const supplementaryQueryTypes: SupplementaryQueryType[] = [
  SupplementaryQueryType.LogsVolume,
  SupplementaryQueryType.LogsSample,
];

const getSupplementaryQuerySettingKey = (type: SupplementaryQueryType) => `grafana.explore.logs.enable${type}`;

export const storeSupplementaryQueryEnabled = (enabled: boolean, type: SupplementaryQueryType): void => {
  store.set(getSupplementaryQuerySettingKey(type), enabled ? 'true' : 'false');
};

export const loadSupplementaryQueries = (): SupplementaryQueries => {
  // We default to true for all supp queries
  let supplementaryQueries: SupplementaryQueries = {
    [SupplementaryQueryType.LogsVolume]: { enabled: true },
    // This is set to false temporarily, until we have UI to display logs sample and a way how to enable/disable it
    [SupplementaryQueryType.LogsSample]: { enabled: false },
  };

  for (const type of supplementaryQueryTypes) {
    if (type === SupplementaryQueryType.LogsVolume) {
      // TODO: Remove this in 10.0 (#61626)
      // For LogsVolume we need to migrate old key to new key. So check for old key:
      // If we have old key: 1) use it 2) migrate to new key 3) delete old key
      // If not, continue with new key
      const oldLogsVolumeEnabledKey = 'grafana.explore.logs.enableVolumeHistogram';
      const shouldBeEnabled = store.get(oldLogsVolumeEnabledKey);
      if (shouldBeEnabled) {
        supplementaryQueries[type] = { enabled: shouldBeEnabled === 'true' ? true : false };
        storeSupplementaryQueryEnabled(shouldBeEnabled === 'true', SupplementaryQueryType.LogsVolume);
        localStorage.removeItem(oldLogsVolumeEnabledKey);
        continue;
      }
    }

    // Only if "false" value in local storage, we disable it
    const shouldBeEnabled = store.get(getSupplementaryQuerySettingKey(type));
    if (shouldBeEnabled === 'false') {
      supplementaryQueries[type] = { enabled: false };
    }
  }
  return supplementaryQueries;
};
