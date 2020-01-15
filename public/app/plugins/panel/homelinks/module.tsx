// Libraries
import React, { PureComponent, FC } from 'react';
import { css, cx } from 'emotion';

// Utils & Services
import { PanelPlugin } from '@grafana/data';
import { stylesFactory, styleMixins } from '@grafana/ui';
import config from 'app/core/config';

// Types
import { PanelProps } from '@grafana/data';

export interface Props extends PanelProps {}

export class GrafanaLinksPanel extends PureComponent<Props> {
  render() {
    const styles = getStyles();

    return (
      <div className={styles.list}>
        <HomeLink title="Documentation" icon="fa fa-book" url="https://grafana.com/docs/grafana/latest" />
        <HomeLink
          title="Getting started"
          icon="fa fa-bolt"
          url="https://grafana.com/docs/grafana/latest/guides/getting_started/"
        />
        <HomeLink title="Community forum" icon="fa fa-comments" url="https://community.grafana.com" />
        <HomeLink
          title="Report a bug"
          icon="fa fa-bug"
          url="https://github.com/grafana/grafana/issues/new?template=1-bug_report.md"
        />
      </div>
    );
  }
}

interface HomeLinkProps {
  title: string;
  url: string;
  target?: string;
  icon: string;
}

export const HomeLink: FC<HomeLinkProps> = ({ title, url, target, icon }) => {
  const styles = getStyles();

  return (
    <a className={styles.item} href={url} target={target}>
      <i className={cx(icon, styles.icon)} />
      {title}
    </a>
  );
};

export const getStyles = stylesFactory(() => {
  const { theme } = config;

  return {
    list: css`
      display: flex;
      flex-direction: column;
    `,
    icon: css`
      padding-right: ${theme.spacing.sm};
    `,
    item: css`
      ${styleMixins.cardChrome(theme)}
      padding: ${theme.spacing.sm};
      display: flex;
      margin-bottom: ${theme.spacing.xs};
      align-items: center;
    `,
  };
});

export const plugin = new PanelPlugin(GrafanaLinksPanel).setDefaults({});
