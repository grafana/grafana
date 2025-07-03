import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Divider, Icon, IconButton, useStyles2 } from '@grafana/ui';
import { CloudBadge } from 'app/core/components/Branding/CloudBadge';
import { backendSrv } from 'app/core/services/backend_srv';
import { contextSrv } from 'app/core/services/context_srv';

type AdCardProps = {
  title: string;
  description: string;
  href: string;
  logoUrl: string;
  items: string[];
  helpFlag: number;
};

export function AdCard({ title, description, href, logoUrl, items, helpFlag }: AdCardProps) {
  const styles = useStyles2(getAddCardStyles);

  const helpFlags = contextSrv.user.helpFlags1;
  const [isDismissed, setDismissed] = useState<boolean>(Boolean(helpFlags & helpFlag));

  const onDismiss = () => {
    backendSrv.put(`/api/user/helpflags/${helpFlag}`, undefined, { showSuccessAlert: false }).then((res) => {
      contextSrv.user.helpFlags1 = res.helpFlags1;
      setDismissed(true);
    });
  };

  if (isDismissed || !isOpenSourceBuildOrUnlicensed()) {
    return null;
  }

  return (
    <div className={styles.cardBody} title={title}>
      <div className={styles.preHeader}>
        <CloudBadge />
        <IconButton name="times" size="sm" onClick={onDismiss} aria-label={t('alerting.ad.close', 'Close')} />
      </div>
      <header className={styles.header}>
        <div className={styles.logoColumn}>
          <img src={logoUrl} alt="" height="40px" width="40px" className={styles.logo} />
        </div>
        <div className={styles.contentColumn}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.description}>{description}</p>
        </div>
      </header>
      <Divider />
      <div className={styles.itemsList}>
        {items.map((item) => (
          <div key={item} className={styles.listItem}>
            <Icon className={styles.icon} name="check" />
            {item}
          </div>
        ))}
      </div>
      <Divider />
      <Button fill="solid" variant="secondary" onClick={() => window.open(href, '_blank')}>
        <Trans i18nKey="alerting.ad.learn-more">Learn more</Trans>
        <Icon name="external-link-alt" className={styles.buttonIcon} />
      </Button>
    </div>
  );
}

const getAddCardStyles = (theme: GrafanaTheme2) => ({
  logo: css({
    objectFit: 'contain',
    width: '47px',
    height: '47px',
  }),

  header: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
    paddingTop: theme.spacing(2),
  }),

  logoColumn: css({
    flexShrink: 0,
  }),

  contentColumn: css({
    flex: 1,
  }),

  title: css({
    marginBottom: theme.spacing(1),
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.h4.fontWeight,
    color: theme.colors.text.primary,
  }),

  description: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.bodySmall.lineHeight,
  }),

  itemsList: css({
    listStyle: 'none',
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: theme.spacing(0.5),
    [theme.breakpoints.up('xl')]: {
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing(1),
    },
  }),

  listItem: css({
    display: 'flex',
    alignItems: 'center',
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    lineHeight: theme.typography.bodySmall.lineHeight,
    marginBottom: theme.spacing(0.5),
  }),

  icon: css({
    marginRight: theme.spacing(1),
    color: theme.colors.success.main,
  }),

  buttonIcon: css({
    marginLeft: theme.spacing(1),
  }),

  button: css({
    marginLeft: theme.spacing(2),
  }),

  cardBody: css({
    padding: theme.spacing(3),
    backgroundColor: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    border: `1px solid ${theme.colors.border.weak}`,
    [theme.breakpoints.up('xl')]: {
      maxWidth: '650px',
      width: '100%',
    },
  }),

  preHeader: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }),
});

export function isOpenSourceBuildOrUnlicensed() {
  if (config.buildInfo.edition === GrafanaEdition.OpenSource) {
    return true;
  }

  if (config.licenseInfo.stateInfo !== 'Licensed') {
    return true;
  }

  return false;
}
