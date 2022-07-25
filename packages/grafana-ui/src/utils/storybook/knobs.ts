import { select } from '@storybook/addon-knobs';

import { getAvailableIcons } from '../../types';

const VISUAL_GROUP = 'Visual options';

export const iconOptions = {
  None: undefined,
  ...getAvailableIcons().reduce<Record<string, string>>((prev, c) => {
    return {
      ...prev,
      [`Icon: ${c}`]: `${c}`,
    };
  }, {}),
};

export const getIconKnob = () => select('Icon', iconOptions, undefined, VISUAL_GROUP);
