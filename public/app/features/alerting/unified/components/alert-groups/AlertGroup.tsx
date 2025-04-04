import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Stack, TextLink, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { AlertmanagerGroup } from 'app/plugins/datasource/alertmanager/types';

import { createContactPointSearchLink } from '../../utils/misc';
import { AlertLabels } from '../AlertLabels';
import { CollapseToggle } from '../CollapseToggle';
import { MetaText } from '../MetaText';

import { AlertGroupAlertsTable } from './AlertGroupAlertsTable';
import { AlertGroupHeader } from './AlertGroupHeader';

interface Props {
  group: AlertmanagerGroup;
  alertManagerSourceName: string;
}

export const AlertGroup = ({ alertManagerSourceName, group }: Props) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const styles = useStyles2(getStyles);

  // When group is grouped, receiver.name is 'NONE' as it can contain multiple receivers
  const receiverInGroup = group.receiver.name !== 'NONE';
  const contactPoint = group.receiver.name;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.group} data-testid="alert-group">
          <CollapseToggle
            size="sm"
            isCollapsed={isCollapsed}
            onToggle={() => setIsCollapsed(!isCollapsed)}
            data-testid="alert-group-collapse-toggle"
          />
          {Object.keys(group.labels).length ? (
            <Stack direction="row" alignItems="center">
              <AlertLabels labels={group.labels} size="sm" />

              {receiverInGroup && (
                <MetaText icon="at">
                  Delivered to{' '}
                  <TextLink
                    href={createContactPointSearchLink(contactPoint, alertManagerSourceName)}
                    variant="bodySmall"
                    color="primary"
                    inline={false}
                  >
                    {group.receiver.name}
                  </TextLink>
                </MetaText>
              )}
            </Stack>
          ) : (
            <span>
              <Trans i18nKey="alerting.alert-group.no-grouping">No grouping</Trans>
            </span>
          )}
        </div>
        <AlertGroupHeader group={group} />
      </div>
      {!isCollapsed && <AlertGroupAlertsTable alertManagerSourceName={alertManagerSourceName} alerts={group.alerts} />}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    '& + &': {
      marginTop: theme.spacing(2),
    },
  }),
  header: css({
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(1),
    backgroundColor: theme.colors.background.secondary,
    width: '100%',
  }),
  group: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
});
