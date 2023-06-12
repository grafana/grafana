import { isValidElement } from 'react';

import { AzureMonitorErrorish } from '../types';

export function messageFromElement(error: AzureMonitorErrorish): AzureMonitorErrorish | undefined {
  if (isValidElement(error)) {
    return error;
  } else {
    return messageFromError(error);
  }
}

export default function messageFromError(error: any): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if (typeof error.message === 'string') {
    return error.message;
  }

  if (typeof error.data?.error?.message === 'string') {
    return error.data.error.message;
  }

  // Copied from the old Angular code - this might be checking for errors in places
  // that the new code just doesnt use.
  // As new error objects are discovered they should be added to the above code, rather
  // than below
  const maybeAMessage =
    error.error?.data?.error?.innererror?.innererror?.message ||
    error.error?.data?.error?.innererror?.message ||
    error.error?.data?.error?.message ||
    error.error?.data?.message ||
    error.data?.message ||
    error;

  if (typeof maybeAMessage === 'string') {
    return maybeAMessage;
  } else if (maybeAMessage && maybeAMessage.toString) {
    return maybeAMessage.toString();
  }

  return undefined;
}
