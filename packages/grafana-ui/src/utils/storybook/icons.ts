import { getAvailableIcons } from '../../types';

// @todo: figure out how best to type this.
export const iconOptions: any = {
  None: undefined,
  ...getAvailableIcons().reduce<Record<string, string>>((prev, c) => {
    return {
      ...prev,
      [`Icon: ${c}`]: `${c}`,
    };
  }, {}),
};
