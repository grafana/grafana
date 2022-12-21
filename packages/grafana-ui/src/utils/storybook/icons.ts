import { getAvailableIcons } from '../../types';

export const iconOptions = {
  None: undefined,
  ...getAvailableIcons().reduce<Record<string, string>>((prev, c) => {
    return {
      ...prev,
      [`Icon: ${c}`]: `${c}`,
    };
  }, {}),
};
