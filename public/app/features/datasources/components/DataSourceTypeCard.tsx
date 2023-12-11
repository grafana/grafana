import { css, cx } from '@emotion/css';
import React from 'react';

import { DataSourcePluginMeta, GrafanaTheme2 } from '@grafana/data';
import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Card, LinkButton, PluginSignatureBadge, useStyles2 } from '@grafana/ui';

export type Props = {
  dataSourcePlugin: DataSourcePluginMeta;
  onClick: () => void;
};

export function DataSourceTypeCard({ onClick, dataSourcePlugin }: Props) {
  const isPhantom = dataSourcePlugin.module === 'phantom';
  const isClickable = !isPhantom && !dataSourcePlugin.unlicensed;
  const learnMoreLink = dataSourcePlugin.info?.links?.length > 0 ? dataSourcePlugin.info.links[0] : null;
  const learnMoreLinkTarget = learnMoreLink?.target ?? '_blank';

  const styles = useStyles2(getStyles);

  return (
    <Card className={cx(styles.card, 'card-parent')} onClick={isClickable ? onClick : () => {}}>
      {/* Name */}
      <Card.Heading
        className={styles.heading}
        aria-label={e2eSelectors.pages.AddDataSource.dataSourcePluginsV2(dataSourcePlugin.name)}
      >
        {dataSourcePlugin.name}
      </Card.Heading>

      {/* Logo */}
      <Card.Figure align="center" className={styles.figure}>
        <img className={styles.logo} src={dataSourcePlugin.info.logos.small} alt="" />
      </Card.Figure>

      <Card.Description className={styles.description}>{dataSourcePlugin.info.description}</Card.Description>

      {/* Signature */}
      {!isPhantom && (
        <Card.Meta className={styles.meta}>
          <PluginSignatureBadge status={dataSourcePlugin.signature} />
        </Card.Meta>
      )}

      {/* Learn more */}
      <Card.Actions className={styles.actions}>
        {learnMoreLink && (
          <LinkButton
            aria-label={`${dataSourcePlugin.name}, learn more.`}
            href={`${learnMoreLink.url}?utm_source=grafana_add_ds`}
            onClick={(e) => e.stopPropagation()}
            rel="noopener"
            target={learnMoreLinkTarget}
            variant="secondary"
          >
            {learnMoreLink.name}
          </LinkButton>
        )}
      </Card.Actions>
    </Card>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    heading: css({
      fontSize: theme.v1.typography.heading.h5,
      fontWeight: 'inherit',
    }),
    figure: css({
      width: 'inherit',
      marginRight: '0px',
      '> img': {
        width: theme.spacing(7),
      },
    }),
    meta: css({
      marginTop: '6px',
      position: 'relative',
    }),
    description: css({
      margin: '0px',
      fontSize: theme.typography.size.sm,
    }),
    actions: css({
      position: 'relative',
      alignSelf: 'center',
      marginTop: '0px',
      opacity: 0,

      '.card-parent:hover &, .card-parent:focus-within &': {
        opacity: 1,
      },
    }),
    card: css({
      gridTemplateAreas: `
        "Figure   Heading   Actions"
        "Figure Description Actions"
        "Figure    Meta     Actions"
        "Figure     -       Actions"`,
    }),
    logo: css({
      marginRight: theme.v1.spacing.lg,
      marginLeft: theme.v1.spacing.sm,
      width: theme.spacing(7),
      maxHeight: theme.spacing(7),
    }),
  };
}
