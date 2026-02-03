import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Button, EmptyState, LoadingPlaceholder, Pagination, Stack, TextLink, useStyles2 } from '@grafana/ui';
import { MetadataRow } from 'app/features/alerting/unified/components/notification-policies/Policy';
import { AlertmanagerAction, useAlertmanagerAbility } from 'app/features/alerting/unified/hooks/useAbilities';
import { AlertmanagerGroup, ROUTES_META_SYMBOL, Receiver, Route } from 'app/plugins/datasource/alertmanager/types';

import { usePagination } from '../../hooks/usePagination';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { useAlertmanager } from '../../state/AlertmanagerContext';
import { K8sAnnotations, ROOT_ROUTE_NAME } from '../../utils/k8s/constants';
import { getAnnotation } from '../../utils/k8s/utils';
import { normalizeMatchers } from '../../utils/matchers';
import { stringifyErrorLike } from '../../utils/misc';
import { ProvisioningBadge } from '../Provisioning';
import { Spacer } from '../Spacer';
import { useGrafanaContactPoints } from '../contact-points/useContactPoints';

import { useAlertGroupsModal } from './Modals';
import { ActionButtons } from './components/ActionButtons';
import { CreateModal } from './components/Modals';
import { RoutingTreeFilter } from './components/RoutingTreeFilter';
import { TIMING_OPTIONS_DEFAULTS } from './timingOptions';
import {
  isRouteProvisioned,
  useCreateRoutingTree,
  useListNotificationPolicyRoutes,
  useRootRouteSearch,
} from './useNotificationPolicyRoute';

const DEFAULT_PAGE_SIZE = 10;

export const PoliciesList = () => {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [queryParams] = useURLSearchParams();

  const [createPoliciesSupported, createPoliciesAllowed] = useAlertmanagerAbility(
    AlertmanagerAction.CreateNotificationPolicy
  );

  const { currentData: allPolicies, isLoading, error: fetchPoliciesError } = useListNotificationPolicyRoutes();

  const [createTrigger] = useCreateRoutingTree();

  const search = queryParams.get('search');

  const [contactPointsSupported, canSeeContactPoints] = useAlertmanagerAbility(AlertmanagerAction.ViewContactPoint);
  const shouldFetchContactPoints = contactPointsSupported && canSeeContactPoints;
  const { contactPoints: receivers } = useGrafanaContactPoints({
    skip: !shouldFetchContactPoints,
    fetchStatuses: false,
    fetchPolicies: false,
  });

  if (isLoading) {
    return <LoadingPlaceholder text={t('alerting.policies-list.text-loading', 'Loading....')} />;
  }

  return (
    <Stack direction="column">
      {/* TODO we can add some additional info here with a ToggleTip */}
      <Stack direction="row" alignItems="end" justifyContent="space-between">
        <RoutingTreeFilter />

        <Stack direction="row" gap={1}>
          {createPoliciesSupported && (
            <Button
              data-testid="create-policy-button"
              icon="plus"
              aria-label={t('alerting.policies-list.create.aria-label', 'add policy')}
              variant="primary"
              disabled={!createPoliciesAllowed}
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Trans i18nKey="alerting.policies-list.create.text">New notification policy</Trans>
            </Button>
          )}
        </Stack>
      </Stack>
      {fetchPoliciesError ? (
        <Alert title={t('alerting.policies-list.fetch.error', 'Failed to fetch policies')}>
          {stringifyErrorLike(fetchPoliciesError)}
        </Alert>
      ) : (
        <RoutingTreeList
          policies={allPolicies ?? []}
          search={search}
          pageSize={DEFAULT_PAGE_SIZE}
          receivers={receivers}
        />
      )}
      <CreateModal
        isOpen={isCreateModalOpen}
        onConfirm={(route) => createTrigger.execute(route)}
        onDismiss={() => setIsCreateModalOpen(false)}
      />
    </Stack>
  );
};

interface RoutingTreeListProps {
  policies: Route[];
  search?: string | null;
  pageSize: number;
  receivers?: Receiver[];
}

const RoutingTreeList = ({ policies, search, pageSize = DEFAULT_PAGE_SIZE, receivers }: RoutingTreeListProps) => {
  const searchResults = useRootRouteSearch(policies, search);
  const { page, pageItems, numberOfPages, onPageChange } = usePagination(searchResults, 1, pageSize);

  if (pageItems.length === 0) {
    return (
      <EmptyState variant="not-found" message={t('alerting.policies-list.empty-state.message', 'No policies found')} />
    );
  }

  return (
    <>
      {pageItems.map((policy, index) => {
        const key = `${policy.name}-${index}`;
        return <RoutingTree key={key} route={policy} receivers={receivers} />;
      })}
      <Pagination currentPage={page} numberOfPages={numberOfPages} onNavigate={onPageChange} hideWhenSinglePage />
    </>
  );
};

interface RoutingTreeProps {
  route: Route;
  receivers?: Receiver[];
}

export const RoutingTree = ({ route, receivers }: RoutingTreeProps) => {
  const styles = useStyles2(getStyles);
  const { selectedAlertmanager } = useAlertmanager();

  const [alertInstancesModal, showAlertGroupsModal] = useAlertGroupsModal(selectedAlertmanager ?? '');

  const matchingInstancesPreview = { enabled: false }; // Placeholder for matching instances preview logic
  const numberOfAlertInstances = undefined; // Placeholder for number of alert instances logic
  const matchingAlertGroups: AlertmanagerGroup[] | undefined = []; // Placeholder for matching alert groups logic
  const matchers = normalizeMatchers(route);

  return (
    <div className={styles.routingTreeWrapper} data-testid={`routing-tree_${route.name ?? 'default'}`}>
      <Stack direction="column" gap={0}>
        <RoutingTreeHeader route={route} />

        <div className={styles.routingTreeMetadataWrapper}>
          <Stack direction="column" gap={0.5}>
            <MetadataRow
              matchingInstancesPreview={matchingInstancesPreview}
              numberOfAlertInstances={numberOfAlertInstances}
              contactPoint={route.receiver ?? undefined}
              groupBy={route.group_by ?? []}
              muteTimings={route.mute_time_intervals ?? []}
              activeTimings={route.active_time_intervals ?? []}
              timingOptions={{
                group_wait: route.group_wait ?? TIMING_OPTIONS_DEFAULTS.group_wait,
                group_interval: route.group_interval ?? TIMING_OPTIONS_DEFAULTS.group_interval,
                repeat_interval: route.repeat_interval ?? TIMING_OPTIONS_DEFAULTS.repeat_interval,
              }}
              alertManagerSourceName={selectedAlertmanager ?? ''}
              receivers={receivers ?? []}
              matchingAlertGroups={matchingAlertGroups}
              matchers={matchers}
              isDefaultPolicy={true}
              onShowAlertInstances={showAlertGroupsModal}
            />
          </Stack>
        </div>
      </Stack>
      {alertInstancesModal}
    </div>
  );
};

interface RoutingTreeHeaderProps {
  route: Route;
}

export const RoutingTreeHeader = ({ route }: RoutingTreeHeaderProps) => {
  const provisioned = isRouteProvisioned(route);
  const styles = useStyles2(getStyles);

  const routeName = route.name === ROOT_ROUTE_NAME || !route.name ? 'Default Policy' : route.name;
  const numberOfPolicies = countPolicies(route);

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1} minWidth={0}>
          <TextLink
            href={`/alerting/routes/policy/${encodeURIComponent(route.name ?? '')}/edit`}
            variant="body"
            color="primary"
            inline={false}
          >
            {routeName}
          </TextLink>
        </Stack>
        {numberOfPolicies > 0 && <>{`Contains ${numberOfPolicies} polic${numberOfPolicies > 1 ? 'ies' : 'y'}`}</>}
        {provisioned && (
          <ProvisioningBadge
            tooltip
            provenance={getAnnotation(route[ROUTES_META_SYMBOL] ?? {}, K8sAnnotations.Provenance)}
          />
        )}
        <Spacer />
        <ActionButtons route={route} />
      </Stack>
    </div>
  );
};

interface HasRoutes {
  routes?: HasRoutes[];
}

export function countPolicies(route: HasRoutes): number {
  let count = 0;
  if (route.routes) {
    count += route.routes.length;
    route.routes.forEach((subRoute) => {
      count += countPolicies(subRoute);
    });
  }
  return count;
}

const getStyles = (theme: GrafanaTheme2) => ({
  routingTreeWrapper: css({
    borderRadius: theme.shape.radius.default,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderBottom: 'none',
  }),
  headerWrapper: css({
    background: `${theme.colors.background.secondary}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    borderTopLeftRadius: `${theme.shape.radius.default}`,
    borderTopRightRadius: `${theme.shape.radius.default}`,
  }),
  routingTreeMetadataWrapper: css({
    position: 'relative',

    background: `${theme.colors.background.primary}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
  }),
});
