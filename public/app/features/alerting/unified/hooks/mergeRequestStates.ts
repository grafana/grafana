interface RequestState {
  error?: unknown;

  isUninitialized: boolean;
  isSuccess: boolean;
  isError: boolean;
  isLoading: boolean;
}

interface RequestStateGroup extends RequestState {
  requests: RequestState[];
}

// @TODO what to do with the other props that we get from RTKQ's state such as originalArgs, etc?
export function mergeRequestStates(...requests: RequestState[]): RequestStateGroup {
  return {
    error: requests.find((s) => s.error),
    isUninitialized: requests.every((s) => s.isUninitialized),
    isSuccess: requests.every((s) => s.isSuccess),
    isError: requests.some((s) => s.isError),
    isLoading: requests.some((s) => s.isLoading),
    requests,
  };
}
