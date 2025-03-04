import { css } from '@emotion/css';
import { PropsWithChildren, ReactNode } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { IconButton, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';
import { GrafanaRulesSourceSymbol, RulesSourceIdentifier } from 'app/types/unified-alerting';
import { RulesSourceApplication } from 'app/types/unified-alerting-dto';

import { Spacer } from '../../components/Spacer';
import { WithReturnButton } from '../../components/WithReturnButton';
import { isAdmin } from '../../utils/misc';

import { DataSourceIcon } from './Namespace';
import { LoadingIndicator } from './RuleGroup';

export interface DataSourceSectionProps extends PropsWithChildren {
  uid: RulesSourceIdentifier['uid'];
  name: string;
  loader?: ReactNode;
  application?: RulesSourceApplication;
  isLoading?: boolean;
  description?: ReactNode;
}

export const DataSourceSection = ({
  uid,
  name,
  application,
  children,
  loader,
  isLoading = false,
  description = null,
}: DataSourceSectionProps) => {
  const styles = useStyles2(getStyles);
  const [isCollapsed, toggleCollapsed] = useToggle(false);
  const configureLink = (() => {
    if (uid === GrafanaRulesSourceSymbol) {
      const userIsAdmin = isAdmin();
      if (!userIsAdmin) {
        return;
      }
      return '/alerting/admin';
    }
    return `/connections/datasources/edit/${String(uid)}`;
  })();
  return (
    <section aria-labelledby={`datasource-${String(uid)}-heading`} role="listitem">
      <Stack direction="column" gap={1}>
        <Stack direction="column" gap={0}>
          {isLoading && <LoadingIndicator datasourceUid={String(uid)} />}
          <div className={styles.dataSourceSectionTitle}>
            {loader ?? (
              <Stack alignItems="center">
                <IconButton
                  name={isCollapsed ? 'angle-right' : 'angle-down'}
                  onClick={toggleCollapsed}
                  aria-label={t('common.collapse', 'Collapse')}
                />
                {application && <DataSourceIcon application={application} />}

                <Text variant="body" weight="bold" element="h2" id={`datasource-${String(uid)}-heading`}>
                  {name}
                </Text>
                {description && (
                  <>
                    {'·'}
                    {description}
                  </>
                )}
                <Spacer />
                {configureLink && (
                  <WithReturnButton
                    title={t('alerting.rule-list.return-button.title', 'Alert rules')}
                    component={
                      <LinkButton variant="secondary" size="sm" href={configureLink}>
                        <Trans i18nKey="alerting.rule-list.configure-datasource">Configure</Trans>
                      </LinkButton>
                    }
                  />
                )}
              </Stack>
            )}
          </div>
        </Stack>
        {!isCollapsed && <div className={styles.itemsWrapper}>{children}</div>}
      </Stack>
    </section>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  itemsWrapper: css({
    position: 'relative',
    marginLeft: theme.spacing(1.5),

    '&:before': {
      content: "''",
      position: 'absolute',
      height: '100%',

      marginLeft: `-${theme.spacing(1.5)}`,
      borderLeft: `solid 1px ${theme.colors.border.weak}`,
    },
  }),
  dataSourceSectionTitle: css({
    background: theme.colors.background.secondary,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
});
