import { logger } from '@percona/platform-core';
import { SHOW_SILENCED_VALUE_KEY, SHOW_SILENCED_DEFAULT } from './FailedChecksTab.constants';

export const loadShowSilencedValue = (): boolean => {
  try {
    const showSilencedValue = window.localStorage.getItem(SHOW_SILENCED_VALUE_KEY);

    if (showSilencedValue === null) {
      return SHOW_SILENCED_DEFAULT;
    }

    return showSilencedValue === 'true';
  } catch (e) {
    logger.error(e);

    return SHOW_SILENCED_DEFAULT;
  }
};

export const saveShowSilencedValue = (value: boolean) => {
  try {
    window.localStorage.setItem(SHOW_SILENCED_VALUE_KEY, `${value}`);
  } catch (e) {
    logger.error(e);
  }
};
