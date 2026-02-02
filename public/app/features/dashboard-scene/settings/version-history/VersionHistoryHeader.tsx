import { css } from '@emotion/css';
import { noop } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, IconButton, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

type VersionHistoryHeaderProps = {
  onClick?: () => void;
  baseVersion?: number;
  newVersion?: number;
  isNewLatest?: boolean;
};

export const VersionHistoryHeader = ({
  onClick = noop,
  baseVersion = 0,
  newVersion = 0,
  isNewLatest = false,
}: VersionHistoryHeaderProps) => {
  const styles = useStyles2(getStyles);

  return (
    <h3 className={styles.header}>
      <IconButton name="arrow-left" size="xl" onClick={onClick} tooltip="Reset version" />
      <span>
        <Trans i18nKey={'bmcgrafana.dashboards.settings.versions.comparision.comparing-text'}>Comparing</Trans>{' '}
        {baseVersion} <Icon name="arrows-h" /> {newVersion}{' '}
        {isNewLatest && (
          <cite className="muted">
            (<Trans i18nKey={'bmcgrafana.dashboards.settings.versions.comparision.latest-text'}>Latest</Trans>)
          </cite>
        )}
      </span>
    </h3>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    fontSize: theme.typography.h3.fontSize,
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(2),
  }),
});
