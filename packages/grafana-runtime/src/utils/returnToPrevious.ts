type ReturnToPreviousHook = () => (title: string, href?: string) => void;

let rtpHook: ReturnToPreviousHook | undefined = undefined;

export const setReturnToPreviousHook = (hook: ReturnToPreviousHook) => {
  rtpHook = hook;
};

export const useReturnToPrevious: ReturnToPreviousHook = () => {
  if (!rtpHook) {
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('useReturnToPrevious hook not found in @grafana/runtime');
    }
    return () => console.error('ReturnToPrevious hook not found');
  }

  return rtpHook();
};
