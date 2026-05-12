import { isNotificationsAPIV1Beta1Enabled } from '../../api/notifications/version';

import {
  useCreateContactPoint as useCreateContactPointV0alpha1,
  useListContactPoints as useListContactPointsV0alpha1,
} from './v0alpha1/useContactPoints';
import {
  useCreateContactPoint as useCreateContactPointV1beta1,
  useListContactPoints as useListContactPointsV1beta1,
} from './v1beta1/useContactPoints';

const useV1Beta1 = isNotificationsAPIV1Beta1Enabled();

// Static types are pinned to v1beta1 to avoid exposing a union to callers. The two version-specific
// hooks share a structurally identical return shape (same OpenAPI spec) but TS treats the underlying
// `EnhancedListReceiverApiResponse` and `TypedUseQueryHookResult<ReducerPath>` types as distinct.
// See notifications/index.ts for the same pattern at the API level.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const useListContactPointsV0alpha1AsV1Beta1 =
  useListContactPointsV0alpha1 as unknown as typeof useListContactPointsV1beta1;
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const useCreateContactPointV0alpha1AsV1Beta1 =
  useCreateContactPointV0alpha1 as unknown as typeof useCreateContactPointV1beta1;

export const useListContactPoints: typeof useListContactPointsV1beta1 = useV1Beta1
  ? useListContactPointsV1beta1
  : useListContactPointsV0alpha1AsV1Beta1;

export const useCreateContactPoint: typeof useCreateContactPointV1beta1 = useV1Beta1
  ? useCreateContactPointV1beta1
  : useCreateContactPointV0alpha1AsV1Beta1;
