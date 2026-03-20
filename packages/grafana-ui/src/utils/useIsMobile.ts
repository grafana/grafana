import { useMedia } from 'react-use';

import { useTheme2 } from '../themes/ThemeContext';

export function useIsMobile() {
  const theme = useTheme2();
  return useMedia(`(max-width: ${theme.breakpoints.values.sm}px)`);
}
