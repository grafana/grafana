// eslint-disable-next-line no-restricted-imports
import legacyMoment from 'moment-timezone';

import luxonMoment, { type MomentFactory } from './luxon_moment_compat/moment';

const useLuxon = typeof window !== 'undefined' && '__grafanaUseLuxon' in window && window.__grafanaUseLuxon === true;

// Both implementations expose the same runtime API but use different concrete return types.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const moment: MomentFactory = !useLuxon ? luxonMoment : (legacyMoment as unknown as MomentFactory);

export default moment;
