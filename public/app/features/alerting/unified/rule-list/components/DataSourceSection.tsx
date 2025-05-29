import { css } from '@emotion/css';
import { PropsWithChildren, ReactNode } from 'react';
import { useToggle } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, useTranslate } from '@grafana/i18n';
import { IconButton, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
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
  const [isCollapsed, toggleCollapsed] = useToggle(false);
  const styles = useStyles2((theme) => getStyles(theme, isCollapsed));

  const { t } = useTranslate();
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
      <Stack direction="column" gap={0}>
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
                  <Text color="secondary">
                    {'·'} {description}
                  </Text>
                )}
                <Spacer />
                {configureLink && (
                  <WithReturnButton
                    title={t('alerting.rule-list.return-button.title', 'Alert rules')}
                    component={
                      <LinkButton variant="secondary" fill="text" size="sm" href={configureLink}>
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

const getStyles = (theme: GrafanaTheme2, isCollapsed = false) => ({
  itemsWrapper: css({
    position: 'relative',
  }),
  dataSourceSectionTitle: css({
    background: theme.colors.background.secondary,
    padding: theme.spacing(1, 1.5),
  }),
});
