import { type RetryOptions } from '@reduxjs/toolkit/query';

import { isFetchError } from '@grafana/runtime';

export const permissionLookupRetryOptions = {
  retryCondition: (error: unknown, _args: unknown, { attempt }: { attempt: number }) =>
    attempt <= 2 &&
    (!isFetchError(error) || error.status < 400 || error.status >= 500 || error.status === 408 || error.status === 429),
} satisfies RetryOptions;
