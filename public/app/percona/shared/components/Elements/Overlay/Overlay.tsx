import React, { FC } from 'react';
import { Spinner } from '@grafana/ui';
import { cx } from 'emotion';
import { OverlayProps } from './Overlay.types';
import { styles } from './Overlay.styles';

export const Overlay: FC<OverlayProps> = ({
  children,
  className,
  dataTestId = 'pmm-overlay-children',
  isPending,
  size = 20,
}) => (
  <div className={cx(styles.getOverlayWrapper(size), className)} data-testid="pmm-overlay-wrapper">
    {isPending ? (
      <>
        <div className={styles.overlay}>
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
