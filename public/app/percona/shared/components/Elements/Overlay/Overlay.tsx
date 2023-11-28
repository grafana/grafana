import { cx } from '@emotion/css';
import React, { FC } from 'react';

import { Spinner } from '@grafana/ui';

import { styles } from './Overlay.styles';
import { OverlayProps } from './Overlay.types';

export const Overlay: FC<React.PropsWithChildren<OverlayProps>> = ({
  children,
  className,
  overlayClassName,
  dataTestId = 'overlay-children',
  isPending,
  size = 20,
}) => (
  <div className={cx(styles.getOverlayWrapper(size), className)} data-testid="pmm-overlay-wrapper">
    {isPending ? (
      <>
        <div className={cx(styles.overlay, overlayClassName)} data-testid="overlay-spinner">
          <Spinner size={size} className={styles.spinner} />
        </div>
        <div className={styles.childrenWrapper} data-testid={dataTestId}>
          {children}
        </div>
      </>
    ) : (
      children
    )}
  </div>
);
