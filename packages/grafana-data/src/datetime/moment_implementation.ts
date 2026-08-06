// eslint-disable-next-line no-restricted-imports
import legacyMoment from 'moment-timezone';

import luxonMoment from './luxon_moment_compat/moment';

let momentImplementation = legacyMoment as unknown as typeof luxonMoment;

export function setDateTimeImplementation(useLuxon: boolean) {
  momentImplementation = useLuxon ? luxonMoment : (legacyMoment as unknown as typeof luxonMoment);
}

export { momentImplementation as default };
