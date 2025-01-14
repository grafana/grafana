import { UserDetailsResponse } from '../../../services/user/User.types';

import { UserDetails } from './user.types';

export const toUserDetailsModel = (res: UserDetailsResponse): UserDetails => ({
  userId: res.user_id,
  productTourCompleted: !!res.product_tour_completed,
  alertingTourCompleted: !!res.alerting_tour_completed,
  snoozedApiKeysMigration: !!res.snoozed_api_keys_migration,
  snoozedPmmVersion: res.snoozed_pmm_version,
});
