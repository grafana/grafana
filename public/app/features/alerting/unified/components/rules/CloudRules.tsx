import { css } from '@emotion/css';
import pluralize from 'pluralize';
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { GrafanaTheme2, urlUtil } from '@grafana/data';
import { LinkButton, LoadingPlaceholder, Pagination, Spinner, Text, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { CombinedRuleNamespace } from 'app/types/unified-alerting';

import { DEFAULT_PER_PAGE_PAGINATION } from '../../../../../core/constants';
import { AlertingAction, useAlertingAbility } from '../../hooks/useAbilities';
import { usePagination } from '../../hooks/usePagination';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { getPaginationStyles } from '../../styles/pagination';
import { getRulesDataSources, getRulesSourceUid } from '../../utils/datasource';
import { isAsyncRequestStatePending } from '../../utils/redux';

import { RulesGroup } from './RulesGroup';
import { useCombinedGroupNamespace } from './useCombinedGroupNamespace';

interface Props {
  namespaces: CombinedRuleNamespace[];
  expandAll: boolean;
}

export const CloudRules = ({ namespaces, expandAll }: Props) => {
  const styles = useStyles2(getStyles);

  const promRules = useUnifiedAlertingSelector((state) => state.promRules);
  const rulesDataSources = useMemo(getRulesDataSources, []);
  const groupsWithNamespaces = useCombinedGroupNamespace(namespaces);

  const dataSourcesLoading = useMemo(
    () => rulesDataSources.filter((ds) => isAsyncRequestStatePending(promRules[ds.name])),
    [promRules, rulesDataSources]
  );

  const hasSomeResults = rulesDataSources.some((ds) => Boolean(promRules[ds.name]?.result?.length));

  const hasDataSourcesConfigured = rulesDataSources.length > 0;
  const hasDataSourcesLoading = dataSourcesLoading.length > 0;
  const hasNamespaces = namespaces.length > 0;

  const { numberOfPages, onPageChange, page, pageItems } = usePagination(
    groupsWithNamespaces,
    1,
    DEFAULT_PER_PAGE_PAGINATION
  );

  return (
    <section className={styles.wrapper}>
      <div className={styles.sectionHeader}>
        <div className={styles.headerRow}>
          <Text element="h2" variant="h5">
            <Trans i18nKey="alerting.list-view.section.dataSourceManaged.title">Data source-managed</Trans>
          </Text>
          {dataSourcesLoading.length ? (
            <LoadingPlaceholder
              className={styles.loader}
              text={`Loading rules from ${dataSourcesLoading.length} ${pluralize('source', dataSourcesLoading.length)}`}
            />
          ) : (
            <div />
          )}
          <CreateRecordingRuleButton />
        </div>
      </div>

      {pageItems.map(({ group, namespace }) => {
        return (
          <RulesGroup
            group={group}
            key={`${getRulesSourceUid(namespace.rulesSource)}-${namespace.name}-${group.name}`}
            namespace={namespace}
            expandAll={expandAll}
            viewMode={'grouped'}
          />
        );
      })}

      {!hasDataSourcesConfigured && <p>There are no Prometheus or Loki data sources configured.</p>}
      {hasDataSourcesConfigured && !hasDataSourcesLoading && !hasNamespaces && <p>No rules found.</p>}
      {!hasSomeResults && hasDataSourcesLoading && <Spinner size="xl" className={styles.spinner} />}

      <Pagination
        className={styles.pagination}
        currentPage={page}
        numberOfPages={numberOfPages}
        onNavigate={onPageChange}
        hideWhenSinglePage
      />
    </section>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  loader: css({
    marginBottom: 0,
  }),
  sectionHeader: css({
    display: 'flex',
    justifyContent: 'space-between',
  }),
  wrapper: css({
    marginBottom: theme.spacing(4),
  }),
  spinner: css({
    textAlign: 'center',
    padding: theme.spacing(2),
  }),
  pagination: getPaginationStyles(theme),
  headerRow: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: theme.spacing(1),
  }),
});

export function CreateRecordingRuleButton() {
  const [createCloudRuleSupported, createCloudRuleAllowed] = useAlertingAbility(AlertingAction.CreateExternalAlertRule);

  const location = useLocation();

  const canCreateCloudRules = createCloudRuleSupported && createCloudRuleAllowed;

  if (canCreateCloudRules) {
    return (
      <LinkButton
        key="new-recording-rule"
        href={urlUtil.renderUrl(`alerting/new/recording`, {
          returnTo: location.pathname + location.search,
        })}
        tooltip="Create new Data source-managed recording rule"
        icon="plus"
        variant="secondary"
      >
        New recording rule
      </LinkButton>
    );
  }
  return null;
}
