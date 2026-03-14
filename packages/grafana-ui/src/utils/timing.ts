interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
}

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  wait = 0,
  options: DebounceOptions = {}
): ((...args: A) => void) & { cancel: () => void } {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const leading = options.leading ?? false;
  const trailing = options.trailing ?? true;

  const invoke = () => {
    if (lastArgs) {
      fn(...lastArgs);
      lastArgs = undefined;
    }
  };

  const debounced = (...args: A) => {
    const shouldCallLeading = leading && timerId === undefined;

    lastArgs = args;

    if (timerId !== undefined) {
      clearTimeout(timerId);
    }

    timerId = setTimeout(() => {
      timerId = undefined;
      if (trailing) {
        invoke();
      } else {
        lastArgs = undefined;
      }
    }, wait);

    if (shouldCallLeading) {
      invoke();
    }
  };

  return Object.assign(debounced, {
    cancel: () => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
        timerId = undefined;
      }
      lastArgs = undefined;
    },
  });
}

export function throttle<A extends unknown[]>(
  fn: (...args: A) => void,
  wait = 0
): ((...args: A) => void) & { cancel: () => void } {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  let lastArgs: A | undefined;

  const throttled = (...args: A) => {
    if (timerId === undefined) {
      fn(...args);
      timerId = setTimeout(() => {
        timerId = undefined;
        if (lastArgs) {
          const trailingArgs = lastArgs;
          lastArgs = undefined;
          fn(...trailingArgs);
        }
      }, wait);
      return;
    }

    lastArgs = args;
  };

  return Object.assign(throttled, {
    cancel: () => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
        timerId = undefined;
      }
      lastArgs = undefined;
    },
  });
}
