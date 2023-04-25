import React from 'react';

import { useStyles2 } from '@grafana/ui';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay';

import { getStyles } from './WidgetWrapper.styles';
import { WidgetWrapperProps } from './WidgetWrapper.types';
export const WidgetWrapper = ({ children, title, isPending = false }: WidgetWrapperProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <Overlay dataTestId="contact-loading" isPending={isPending}>
        <div className={styles.widgetWrapper}>
          {title && (
            <span className={styles.widgetTitle}>
              <strong>{title}</strong>
            </span>
          )}
          {!isPending && children}
        </div>
      </Overlay>
    </div>
  );
};
