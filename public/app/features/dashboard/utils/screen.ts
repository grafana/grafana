import { useWindowSize } from 'react-use';

export const useIsDesktop = () => {
  const { width } = useWindowSize();

  return width > 1024;
};
