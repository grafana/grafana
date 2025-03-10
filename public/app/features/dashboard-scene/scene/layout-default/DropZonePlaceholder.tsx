import { css } from '@emotion/css';
import classNames from 'classnames';
import { forwardRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export const DropZonePlaceholder = forwardRef<HTMLDivElement>((_, ref) => {
  const styles = useStyles2(getStyles);

  return <div className={classNames('react-grid-item', 'react-grid-placeholder', styles.placeholder)} ref={ref}></div>;
});

const getStyles = (theme: GrafanaTheme2) => ({
  placeholder: css({
    position: 'fixed',
    top: 0,
    left: 0,
    pointerEvents: 'none',
    zIndex: '1000',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'transform 150ms ease',
    },
  }),
});
