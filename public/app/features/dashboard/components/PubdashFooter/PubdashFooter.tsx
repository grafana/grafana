import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2, colorManipulator } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

export interface PublicDashboardFooter {
  hide: boolean;
  text: string;
  logo: string;
  link: string;
}

export const PubdashFooter = function () {
  const styles = useStyles2(getStyles);
  const conf = getPubdashFooterConfig();

  return conf.hide ? null : (
    <div className={styles.footer}>
      <span className={styles.logoText}>
        <a href={conf.link} target="_blank" rel="noreferrer noopener">
          {conf.text} <img className={styles.logoImg} alt="" src={conf.logo}></img>
        </a>
      </span>
    </div>
  );
};

export function setPubdashFooterConfigFn(fn: typeof getPubdashFooterConfig) {
  getPubdashFooterConfig = fn;
}
export let getPubdashFooterConfig = (): PublicDashboardFooter => ({
  hide: false,
  text: 'powered by Grafana',
  logo: 'public/img/grafana_icon.svg',
  link: 'https://grafana.com/',
});

const getStyles = (theme: GrafanaTheme2) => ({
  footer: css`
    position: absolute;
    height: 30px;
    bottom: 0;
    width: 100%;
    background-color: ${colorManipulator.alpha(theme.colors.background.canvas, 0.7)};
    text-align: right;
    font-size: ${theme.typography.body.fontSize};
    z-index: ${theme.zIndex.navbarFixed};
  `,
  logoText: css`
    margin-right: ${theme.spacing(1)};
  `,
  logoImg: css`
    height: 100%;
    padding: ${theme.spacing(0.25, 0, 0.5, 0)};
  `,
});
