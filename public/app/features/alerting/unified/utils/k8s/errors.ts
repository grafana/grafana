import { get } from 'lodash';

import { t } from '@grafana/i18n';
import { FetchError, isFetchError } from '@grafana/runtime';

import { getErrorCode } from '../misc';

export const ERROR_NEWER_CONFIGURATION = 'alerting.notifications.conflict' as const;
export const ERROR_ROUTES_MATCHER_CONFLICT = 'alerting.notifications.routes.conflictingMatchers' as const;

export type ApiMachineryErrorResponse = FetchError<ApiMachineryError>;

// these are known error IDs, used by both Kubernetes API and the front-end (using error `cause`).
export type KnownErrorCodes = typeof ERROR_NEWER_CONFIGURATION;
// Kubernetes API Machinery errors are a superset of supported errors codes.
export type KnownMachineryErrorCodes = KnownErrorCodes | typeof ERROR_ROUTES_MATCHER_CONFLICT;

/**
 * This function gives us the opportunity to translate or transform error codes that are returned from the Kubernetes APIs
 */
export function getErrorMessageFromApiMachineryErrorResponse(error: ApiMachineryErrorResponse): string | undefined {
  const code = getErrorCode(error);
  if (!code) {
    return error.data.message;
  }

  const errorMessageMap: Record<KnownMachineryErrorCodes, string | undefined> = {
    [ERROR_NEWER_CONFIGURATION]: getErrorMessageFromCode(code),
    [ERROR_ROUTES_MATCHER_CONFLICT]: t(
      'alerting.policies.update-errors.routes.conflictingMatchers',
      'Cannot add or update route: matchers conflict with an external routing tree if we merged matchers {{-matchers}}. This would make the route unreachable.',
      {
        matchers:
          error.data.details?.causes?.map((cause) => cause.message).join(', ') ??
          t('alerting.policies.update-errors.routes.unknownMatchers', '<unknown matchers>'),
      }
    ),
  };

  // @ts-expect-error this allows the typechecker to warn us about forgetting to handle some KnownMachineryErrors and still return "undefined" for unknown codes;
  return errorMessageMap[code];
}

/**
 * This function gives us the opportunity to translate or transform error codes
 */
export function getErrorMessageFromCode(code: string): string | undefined {
  const errorMessageMap: Record<KnownErrorCodes, string> = {
    [ERROR_NEWER_CONFIGURATION]: t(
      'alerting.policies.update-errors.conflict',
      'The notification policy tree has been updated by another user.'
    ),
  };

  // @ts-expect-error this allows the typechecker to warn us about forgetting to handle some KnownErrors and still return "undefined" for unknown codes;
  return errorMessageMap[code];
}

export type ApiMachineryError = {
  kind: 'Status';
  apiVersion: string;
  code: number;
  details?: {
    uid: string;
    name?: string;
    group?: string;
    kind?: string;
    retryAfterSeconds?: number;
    // https://github.com/kubernetes/apimachinery/blob/v0.33.2/pkg/apis/meta/v1/types.go#L1020-L1040
    causes?: Array<{
      message?: string;
      field?: string;
      reason?: string;
    }>;
  };
  status: 'Failure';
  metadata?: Record<string, unknown>;
  message: string;
  reason: string;
};

export function isApiMachineryError(error: unknown): error is ApiMachineryErrorResponse {
  return isFetchError(error) && get(error.data, 'kind') === 'Status' && get(error.data, 'status') === 'Failure';
}
