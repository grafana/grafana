import { select } from '@storybook/addon-knobs';
import { getAvailableDefaultIcons } from '../../types';

const VISUAL_GROUP = 'Visual options';

const iconOptions = {
  None: undefined,
  ...getAvailableDefaultIcons().reduce<Record<string, string>>((prev, c) => {
    return {
      ...prev,
      [`Icon: ${c}`]: `${c}`,
    };
  }, {}),
};

export const getIconKnob = () => select('Icon', iconOptions, undefined, VISUAL_GROUP);
