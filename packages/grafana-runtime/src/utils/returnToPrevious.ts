interface ReturnToPreviousData {
  title: string;
  href: string;
}

type ReturnToPreviousHook = () => (rtp: ReturnToPreviousData) => void;

let rtpHook: ReturnToPreviousHook | undefined = undefined;

export const setReturnToPreviousHook = (hook: ReturnToPreviousHook) => {
  rtpHook = hook;
};

export const useReturnToPrevious: ReturnToPreviousHook = () => {
  if (!rtpHook) {
    throw new Error('rtpHook not defined yet');
  }

  return rtpHook();
};
