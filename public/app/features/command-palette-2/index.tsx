/* eslint @grafana/no-untranslated-strings: 0 */
/* eslint @grafana/no-border-radius-literal: 0 */

import { css } from '@emotion/css';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Portal, useStyles2 } from '@grafana/ui';
import { getModKey } from 'app/core/utils/browser';

// interface CommandPalette2Props {}

export function CommandPalette2() {
  const styles = useStyles2(getStyles);
  const modKey = useMemo(() => getModKey(), []);

  return (
    <Portal>
      <div className={styles.wrapper}>
        <div className={styles.palette}>
          <div className={styles.inputBarCell}>
            <Icon name="search" />
            <input className={styles.searchInput} type="text" placeholder="Search for anything..." />
            <div className={styles.shortcut}>
              <span className={styles.keyboardKey}>{modKey}</span>
              <span className={styles.keyboardKey}>K</span>
            </div>
          </div>
          <div className={styles.mainCell}>main</div>
          <div className={styles.detailCell}>detail</div>
          <div className={styles.footerCell}>footer</div>
        </div>
      </div>
    </Portal>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: 'hidden',
      background: 'rgba(255, 255, 255, 0.10)',
      backdropFilter: 'blur(2px)',
    }),

    palette: css({
      height: '70vh',
      maxHeight: 650,
      width: '100%',
      maxWidth: 800,
      margin: '32px auto',
      overflow: 'hidden',
      borderRadius: 10,
      background: 'rgba(0, 0, 0, 0.80)',
      display: 'grid',
      gridTemplateRows: 'auto 1fr auto',
      gridTemplateColumns: '1fr 1fr',
      backdropFilter: 'blur(20px)',
      boxShadow: [
        '0px 32px 32px -16px rgba(0, 0, 0, 0.15)',
        '0px 16px 16px -8px rgba(0, 0, 0, 0.15)',
        '0px 8px 8px -4px rgba(0, 0, 0, 0.15)',
        '0px 4px 4px -2px rgba(0, 0, 0, 0.15)',
        '0px 2px 2px -1px rgba(0, 0, 0, 0.15)',
        '0px 1px 1px 0px rgba(255, 255, 255, 0.10) inset',
      ].join(','),
      gridTemplateAreas: gt([
        // no prettier
        ['input', 'input'],
        ['main', 'detail'],
        ['footer', 'footer'],
      ]),
    }),

    inputBarCell: css({
      padding: theme.spacing(3),
      gridArea: 'input',
      background: 'rgba(0, 0, 0, 0.40)',
      display: 'grid',
      gridTemplateColumns: 'auto 1fr auto',
      gap: theme.spacing(2),
    }),

    searchInput: css({
      all: 'unset',
    }),

    mainCell: css({
      padding: 8,
      gridArea: 'main',
      // background: 'green',
    }),

    detailCell: css({
      padding: 8,
      gridArea: 'detail',
      // background: 'yellow',
    }),

    footerCell: css({
      padding: 8,
      gridArea: 'footer',
      background: '#16161E80',
    }),

    shortcut: css({
      display: 'flex',
      gap: 4,
    }),

    keyboardKey: css({
      display: 'inline-block',
      width: 24,
      height: 24,
      borderRadius: 6,
      border: `1px solid #2D2D32`,
      background: '#0D0D0F',
      textAlign: 'center',
    }),
  };
};

const gt = (gridDef: Array<string | string[]>) => {
  return gridDef
    .map((row) => {
      const rowString = typeof row === 'string' ? row : row.join(' ');
      return `"${rowString}"`;
    })
    .join('\n');
};
