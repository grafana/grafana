import { css } from '@emotion/css';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { featureEnabled } from '@grafana/runtime';
import { Card, Grid, useStyles2, Stack, Badge } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import {
  PluginAngularBadge,
  PluginDeprecatedBadge,
  PluginDisabledBadge,
  PluginInstalledBadge,
  PluginUpdateAvailableBadge,
} from 'app/features/plugins/admin/components/Badges';
import { getBadgeColor } from 'app/features/plugins/admin/components/Badges/sharedStyles';
import { isPluginUpdatable } from 'app/features/plugins/admin/helpers';
import { CatalogPlugin } from 'app/features/plugins/admin/types';

const getStyles = (theme: GrafanaTheme2) => ({
  heading: css({
    fontSize: theme.typography.h5.fontSize,
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
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  card: css({
    gridTemplateAreas: `
        "Figure   Heading   Actions"
        "Figure Description Actions"
        "Figure    Meta     Actions"
        "Figure     -       Actions"`,
  }),
  logo: css({
    marginRight: theme.spacing(3),
    marginLeft: theme.spacing(1),
    width: theme.spacing(7),
    maxHeight: theme.spacing(7),
  }),
});

function PluginEnterpriseBadgeWithoutSignature() {
  const customBadgeStyles = useStyles2(getBadgeColor);

  if (featureEnabled('enterprise.plugins')) {
    return <Badge text={t('get-enterprise.title', 'Enterprise')} color="blue" />;
  }

  return (
    <Badge
      icon="lock"
      role="img"
      aria-label={t('lock-icon', 'lock icon')}
      text={t('get-enterprise.title', 'Enterprise')}
      color="darkgrey"
      className={customBadgeStyles}
      title={t('get-enterprise.requires-license', 'Requires a Grafana Enterprise license')}
    />
  );
}

export type CardGridItem = CatalogPlugin & {
  logo?: string;
};

export interface CardGridProps {
  items: CardGridItem[];
  onClickItem?: (e: React.MouseEvent<HTMLElement>, item: CardGridItem) => void;
}

export const CardGrid = ({ items, onClickItem }: CardGridProps) => {
  const styles = useStyles2(getStyles);

  return (
    <Grid gap={1.5} minColumnWidth={44}>
      {items.map((item) => (
        <Card
          key={item.id}
          className={styles.card}
          href={item.url}
          onClick={(e) => {
            if (onClickItem) {
              onClickItem(e, item);
            }
          }}
        >
          <Card.Heading className={styles.heading}>{item.name}</Card.Heading>

          <Card.Figure align="center" className={styles.figure}>
            <img className={styles.logo} src={item.logo} alt="" />
          </Card.Figure>
          <Card.Meta className={styles.meta}>
            <Stack height="auto" wrap="wrap">
              {item.isEnterprise && <PluginEnterpriseBadgeWithoutSignature />}
              {item.isDeprecated && <PluginDeprecatedBadge />}
              {item.isInstalled && <PluginInstalledBadge />}
              {item.isDisabled && <PluginDisabledBadge error={item.error} />}
              {isPluginUpdatable(item) && <PluginUpdateAvailableBadge plugin={item} />}
              {item.angularDetected && <PluginAngularBadge />}
            </Stack>
          </Card.Meta>
        </Card>
      ))}
    </Grid>
  );
};
