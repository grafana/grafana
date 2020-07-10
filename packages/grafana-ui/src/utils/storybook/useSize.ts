import { select } from '@storybook/addon-knobs';
import { ComponentSize } from '../../types/size';

export function useSize(size: ComponentSize = 'md') {
  const sizes = ['xs', 'sm', 'md', 'lg'];
  return select('Size', sizes, size);
}
