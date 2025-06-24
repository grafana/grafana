import { getFeatureToggle } from '../../utils/featureToggle';

// The moment.js format to use for datetime inputs when the regionalFormat option is set.
const COMMON_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const commonFormat = getFeatureToggle('localeFormatPreference') ? COMMON_FORMAT : undefined;
