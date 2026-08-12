import { css } from '@emotion/css';
import * as React from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { type IconName } from '../../types/icon';

interface Props {
  /** @deprecated */
  icon?: IconName;
  /** @deprecated */
  iconClass?: string;
}

/** @internal */
export const ModalTabContent = ({ children }: React.PropsWithChildren<Props>) => {
  const styles = useStyles2(getStyles);

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    margin: theme.spacing(0, 0, 3, 0),
  }),
  content: css({
    flexGrow: 1,
  }),
});
