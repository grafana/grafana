import { getAvailableIcons } from '../../types';

export const iconOptions: Record<string, string | undefined> = {
  None: undefined,
  ...getAvailableIcons().reduce<Record<string, string>>((prev, c) => {
    return {
      ...prev,
      [`${c}`]: `Icon: ${c}`,
    };
  }, {}),
};
