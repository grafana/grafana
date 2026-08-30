import { forwardRef } from 'react';

import { Icon, type IconProps } from '../Icon/Icon';

interface Props extends Omit<IconProps, 'name'> {
  isLoading: boolean;
  isOpen: boolean;
}

export const SuffixIcon = forwardRef<SVGElement, Props>(({ isLoading, isOpen, ...rest }, ref) => {
  const suffixIcon = isLoading
    ? 'spinner'
    : // If it's loading, show loading icon. Otherwise, icon indicating menu state
      isOpen
      ? 'search'
      : 'angle-down';

  return <Icon {...rest} name={suffixIcon} ref={ref} />;
});

SuffixIcon.displayName = 'SuffixIcon';
