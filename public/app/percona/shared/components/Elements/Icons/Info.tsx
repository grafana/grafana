/* eslint max-len: 0 */
import React, { FC } from 'react';
import { useTheme } from '@grafana/ui';
import { cx } from '@emotion/css';
import { getStyles } from './Icons.styles';
import { SvgProps } from './Icons.types';

export const Info: FC<SvgProps> = ({ className, ...rest }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      enableBackground="new 0 0 422.738 422.737"
      viewBox="0 0 422.738 422.737"
      className={cx(className, styles.icon)}
      {...rest}
    >
      <path
        d="M211.369,0C94.819,0,0,94.819,0,211.368c0,116.55,94.819,211.369,211.369,211.369
c116.549,0,211.37-94.819,211.37-211.369C422.738,94.819,327.918,0,211.369,0z M211.369,403.355
c-105.862,0-191.986-86.125-191.986-191.987c0-105.861,86.125-191.986,191.986-191.986s191.987,86.125,191.987,191.986
C403.355,317.23,317.23,403.355,211.369,403.355z"
      />
      <circle cx="211.041" cy="129.291" r="23.233" fill="#9C9C9C" />
      <polygon points="228 186.713 228 169.737 198.359 169.737 178 169.737 178 178.737 194 178.737 194 305.737 178 305.737 178 314.737 198.359 314.737 232.152 314.737 244 314.737 244 305.737 228 305.737" />
    </svg>
  );
};
