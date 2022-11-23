import { UserDetailsResponse } from '../../../services/user/User.types';

import { UserDetails } from './user.types';

export const toUserDetailsModel = (res: UserDetailsResponse): UserDetails => ({
  userId: res.user_id,
  productTourCompleted: !!res.product_tour_completed,
  alertingTourCompleted: !!res.alerting_tour_completed,
});
