import {
  API_GROUP as API_GROUP_V0ALPHA1,
  API_VERSION as API_VERSION_V0ALPHA1,
  BASE_URL as BASE_URL_V0ALPHA1,
  generatedAPI as notificationsAPIv0alpha1,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import {
  API_GROUP as API_GROUP_V1BETA1,
  API_VERSION as API_VERSION_V1BETA1,
  BASE_URL as BASE_URL_V1BETA1,
  generatedAPI as notificationsAPIv1beta1,
} from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';

import { isNotificationsAPIV1Beta1Enabled } from './version';

const useV1Beta1 = isNotificationsAPIV1Beta1Enabled();

/**
 * The active generated RTK Query client for `notifications.alerting.grafana.app`. Resolves to
 * either `v0alpha1` or `v1beta1` based on the `alerting.notificationsAPIV1Beta1` feature toggle.
 *
 * Use this in place of importing `generatedAPI` directly from either version package, so that the
 * eventual cleanup PR only needs to update this single module instead of every consumer.
 *
 * The static type is pinned to v1beta1's shape. The two generated clients are structurally
 * identical (same OpenAPI spec) but TS treats them as distinct because their `ReducerPath` string
 * literals differ — without this narrowing, consumers see a union type that breaks `extends`
 * clauses, `enhanceEndpoints` parameter inference, and generic argument passing. The runtime
 * `reducerPath` on the v0alpha1 branch remains `'notificationsAlertingAPIv0alpha1'`; RTK Query
 * keys off that runtime value, not the TS type.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const v0alpha1AsV1Beta1 = notificationsAPIv0alpha1 as unknown as typeof notificationsAPIv1beta1;

export const notificationsAPI: typeof notificationsAPIv1beta1 = useV1Beta1
  ? notificationsAPIv1beta1
  : v0alpha1AsV1Beta1;

export const API_GROUP: typeof API_GROUP_V1BETA1 = useV1Beta1 ? API_GROUP_V1BETA1 : API_GROUP_V0ALPHA1;
export const API_VERSION: typeof API_VERSION_V1BETA1 | typeof API_VERSION_V0ALPHA1 = useV1Beta1
  ? API_VERSION_V1BETA1
  : API_VERSION_V0ALPHA1;
export const BASE_URL: string = useV1Beta1 ? BASE_URL_V1BETA1 : BASE_URL_V0ALPHA1;

// Types are sourced from v1beta1 unconditionally. The two generated clients produce structurally
// identical types (same OpenAPI spec), so consumers see the same shape regardless of the toggle.
export type * from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
