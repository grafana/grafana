import { type AnchorHTMLAttributes } from 'react';
import * as React from 'react';

import { type ButtonProps } from '../Button/Button';
import { StyledButton } from '../Button/StyledButton';

export type ButtonLinkProps = ButtonProps & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'aria-label'>;

export const LinkButton = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(({ onBlur, onFocus, ...props }, ref) => {
  return <StyledButton ref={ref} {...props} as="a" />;
});

LinkButton.displayName = 'LinkButton';
