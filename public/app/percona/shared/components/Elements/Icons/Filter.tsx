/* eslint max-len: 0 */

import React, { FC } from 'react';
import { useTheme } from '@grafana/ui';
import { cx } from '@emotion/css';
import { getStyles } from './Icons.styles';
import { SvgProps } from './Icons.types';

export const Filter: FC<SvgProps> = ({ className, ...rest }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <svg
      width="13"
      height="8"
      viewBox="0 0 13 8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cx(className, styles.icon)}
      {...rest}
    >
      <path d="M11.833 1.3975H0.647055C0.289654 1.3975 0 1.08466 0 0.69875C0 0.312844 0.289712 0 0.647055 0H11.8329C12.1903 0 12.48 0.312875 12.48 0.69875C12.48 1.08466 12.1903 1.3975 11.833 1.3975Z" />
      <path d="M10.0449 4.64118H2.4349C2.07752 4.64118 1.78784 4.3283 1.78784 3.9424C1.78784 3.55649 2.07755 3.24368 2.4349 3.24368H10.0449C10.4022 3.24368 10.692 3.55653 10.692 3.9424C10.692 4.32833 10.4022 4.64118 10.0449 4.64118Z" />
      <path d="M8.49765 7.88483H3.98253C3.62513 7.88483 3.33545 7.57196 3.33545 7.18608C3.33545 6.80015 3.62516 6.48737 3.98253 6.48737H8.49765C8.85502 6.48737 9.1447 6.80021 9.1447 7.18608C9.1447 7.57196 8.85499 7.88483 8.49765 7.88483Z" />
    </svg>
  );
};
