export const getReturnToPrevious = () => {
  const returnToPrevious = sessionStorage.getItem('returnToPrevious');
  return returnToPrevious ? JSON.parse(returnToPrevious) : returnToPrevious;
};

export const setReturnToPrevious = ({ title, href }: { title: string; href: string }) => {
  const returnToPrevious = JSON.stringify({ title, href });
  sessionStorage.setItem('returnToPrevious', returnToPrevious);
};

export const clearReturnToPrevious = () => {
  sessionStorage.removeItem('returnToPrevious');
};

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
