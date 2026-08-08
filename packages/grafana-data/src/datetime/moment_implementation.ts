// eslint-disable-next-line no-restricted-imports
import legacyMoment from 'moment-timezone';

import luxonMoment from './luxon_moment_compat/moment';

const useLuxon =
  typeof window !== 'undefined' &&
  window.grafanaBootData?.settings.featureToggles['datetime.useLuxon'] === true;

export default useLuxon ? luxonMoment : (legacyMoment as unknown as typeof luxonMoment);
