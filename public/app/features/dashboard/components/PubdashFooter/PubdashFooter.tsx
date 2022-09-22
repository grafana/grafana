import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, colorManipulator } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export default function PubdashFooter() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.footer}>
      <span className={styles.logoText}>
        powered by Grafana <img className={styles.logoImg} src="public/img/grafana_icon.svg"></img>
      </span>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  footer: css`
    position: absolute;
    height: 30px;
    bottom: 0px;
    width: 100%;
    background-color: ${colorManipulator.alpha(theme.colors.background.canvas, 0.7)};
    text-align: right;
    font-size: 1em;
    z-index: 100000;
  `,
  logoText: css`
    margin-right: 5px;
  `,
  logoImg: css`
    height: 100%;
    padding: 2px 0 4px 0;
  `,
});
