import { css } from '@emotion/css';
import { Fragment } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  Button,
  Dropdown,
  EmptyState,
  LinkButton,
  LoadingPlaceholder,
  Menu,
  Pagination,
  Stack,
  Text,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { MetadataRow } from 'app/features/alerting/unified/components/notification-policies/Policy';
import {
  AlertmanagerAction,
  useAlertmanagerAbilities,
  useAlertmanagerAbility,
} from 'app/features/alerting/unified/hooks/useAbilities';
import { AlertmanagerGroup, Receiver, Route, ROUTES_META_SYMBOL } from 'app/plugins/datasource/alertmanager/types';

import { useAlertmanager } from '../../state/AlertmanagerContext';
import { stringifyErrorLike } from '../../utils/misc';
import {
  useCreateRoutingTree,
  useDeleteRoutingTree,
  useListNotificationPolicyRoutes,
  useRootRouteSearch,
} from './useNotificationPolicyRoute';
import { useURLSearchParams } from '../../hooks/useURLSearchParams';
import { usePagination } from '../../hooks/usePagination';
import { useCreateRoutingTreeModal, useDeleteRoutingTreeModal } from './components/Modals';
import { ALL_ROUTING_TREES, useExportRoutingTree } from './useExportRoutingTree';
import { K8sAnnotations, ROOT_ROUTE_NAME } from '../../utils/k8s/constants';
import ConditionalWrap from '../../components/ConditionalWrap';
import { ProvisioningBadge } from '../Provisioning';
import { getAnnotation } from '../../utils/k8s/utils';
import { Spacer } from '../Spacer';
import MoreButton from '../../components/MoreButton';
import { useGrafanaContactPoints } from '../contact-points/useContactPoints';
import { useAlertGroupsModal } from './Modals';
import { normalizeMatchers } from '../../utils/matchers';
import { RoutingTreeFilter } from './components/RoutingTreeFilter';
import { TIMING_OPTIONS_DEFAULTS } from './timingOptions';

const DEFAULT_PAGE_SIZE = 10;

export const PoliciesList = () => {
  const [queryParams] = useURLSearchParams();

  const [[createPoliciesSupported, createPoliciesAllowed], [exportPoliciesSupported, exportPoliciesAllowed]] =
    useAlertmanagerAbilities([
      AlertmanagerAction.CreateNotificationPolicy,
      AlertmanagerAction.ExportNotificationPolicies,
    ]);

  const { currentData: allPolicies, isLoading, error: fetchPoliciesError } = useListNotificationPolicyRoutes();

  const [ExportDrawer, showExportDrawer] = useExportRoutingTree();

  const [createTrigger] = useCreateRoutingTree();
  const [CreateModal, showCreateModal] = useCreateRoutingTreeModal(createTrigger.execute);

  const search = queryParams.get('search');

  const [contactPointsSupported, canSeeContactPoints] = useAlertmanagerAbility(AlertmanagerAction.ViewContactPoint);
  const shouldFetchContactPoints = contactPointsSupported && canSeeContactPoints;
  const { contactPoints: receivers } = useGrafanaContactPoints({
    skip: !shouldFetchContactPoints,
    fetchStatuses: false,
    fetchPolicies: false,
  });

  if (isLoading) {
    return <LoadingPlaceholder text={'Loading...'} />;
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
              aria-label={'add policy'}
              variant="primary"
              disabled={!createPoliciesAllowed}
              onClick={() => showCreateModal()}
            >
              Create policy
            </Button>
          )}
          {exportPoliciesSupported && (
            <Button
              data-testid="export-all-policy-button"
              icon="download-alt"
              variant="secondary"
              aria-label={'export all'}
              disabled={!exportPoliciesAllowed}
              onClick={() => showExportDrawer(ALL_ROUTING_TREES)}
            >
              Export all
            </Button>
          )}
        </Stack>
      </Stack>
      {fetchPoliciesError ? (
        <Alert title={'Failed to fetch policies'}>{stringifyErrorLike(fetchPoliciesError)}</Alert>
      ) : (
        <RoutingTreeList
          policies={allPolicies ?? []}
          search={search}
          pageSize={DEFAULT_PAGE_SIZE}
          receivers={receivers}
        />
      )}
      {CreateModal}
      {ExportDrawer}
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
    return <EmptyState variant="not-found" message={'No policies found'} />;
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

  const [deleteTrigger] = useDeleteRoutingTree();
  const [DeleteModal, showDeleteModal] = useDeleteRoutingTreeModal(deleteTrigger.execute);
  const [alertInstancesModal, showAlertGroupsModal] = useAlertGroupsModal(selectedAlertmanager ?? '');

  const matchingInstancesPreview = { enabled: false }; // Placeholder for matching instances preview logic
  const numberOfAlertInstances = undefined; // Placeholder for number of alert instances logic
  const matchingAlertGroups: AlertmanagerGroup[] | undefined = []; // Placeholder for matching alert groups logic
  const matchers = normalizeMatchers(route);

  return (
    <div className={styles.routingTreeWrapper} data-testid={`routing-tree_${route.name ?? 'default'}`}>
      <Stack direction="column" gap={0}>
        <RoutingTreeHeader
          route={route}
          onDelete={(routeToDelete) =>
            showDeleteModal({
              name: routeToDelete[ROUTES_META_SYMBOL]?.name ?? '',
              resourceVersion: routeToDelete[ROUTES_META_SYMBOL]?.resourceVersion,
            })
          }
        />

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
      {DeleteModal}
      {alertInstancesModal}
    </div>
  );
};

interface RoutingTreeHeaderProps {
  route: Route;
  onDelete: (route: Route) => void;
}

export const RoutingTreeHeader = ({ route, onDelete }: RoutingTreeHeaderProps) => {
  const provisioned = route[ROUTES_META_SYMBOL]?.provisioned ?? false;
  const styles = useStyles2(getStyles);

  const [
    [updatePoliciesSupported, updatePoliciesAllowed],
    [deletePoliciesSupported, deletePoliciesAllowed],
    [exportPoliciesSupported, exportPoliciesAllowed],
  ] = useAlertmanagerAbilities([
    AlertmanagerAction.UpdateNotificationPolicyTree,
    AlertmanagerAction.DeleteNotificationPolicy,
    AlertmanagerAction.ExportNotificationPolicies,
  ]);

  const canEdit = updatePoliciesSupported && updatePoliciesAllowed && !provisioned;

  const [ExportDrawer, showExportDrawer] = useExportRoutingTree();

  const menuActions: JSX.Element[] = [];
  if (exportPoliciesSupported) {
    menuActions.push(
      <Fragment key="export-contact-point">
        <Menu.Item
          icon="download-alt"
          label={t('alerting.use-create-dropdown-menu-actions.label-export', 'Export')}
          ariaLabel="export"
          disabled={!exportPoliciesAllowed}
          data-testid="export"
          onClick={() => showExportDrawer(route.name ?? '')}
        />
        <Menu.Divider />
      </Fragment>
    );
  }

  if (deletePoliciesSupported) {
    const canBeDeleted = deletePoliciesAllowed && !provisioned;
    const isDefaultPolicy = route.name === ROOT_ROUTE_NAME;

    const cannotDeleteNoPermissions = `You do not have the required permission to ${isDefaultPolicy ? 'reset' : 'delete'} this routing tree`;
    const cannotDeleteProvisioned = `Routing tree is provisioned and cannot be ${isDefaultPolicy ? 'reset' : 'deleted'} via the UI`;

    const reasonsDeleteIsDisabled = [
      !deletePoliciesAllowed ? cannotDeleteNoPermissions : '',
      provisioned ? cannotDeleteProvisioned : '',
    ].filter(Boolean);

    const deleteTooltipContent = (
      <>
        {`Routing tree cannot be ${isDefaultPolicy ? 'reset' : 'deleted'} for the following reasons:`}
        <br />
        {reasonsDeleteIsDisabled.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </>
    );

    menuActions.push(
      <ConditionalWrap
        key="delete-routing-tree"
        shouldWrap={!canBeDeleted}
        wrap={(children) => (
          <Tooltip content={deleteTooltipContent} placement="top">
            <span>{children}</span>
          </Tooltip>
        )}
      >
        <Menu.Item
          label={
            route.name === ROOT_ROUTE_NAME
              ? 'Reset'
              : t('alerting.use-create-dropdown-menu-actions.label-delete', 'Delete')
          }
          ariaLabel="delete"
          icon="trash-alt"
          destructive
          disabled={!canBeDeleted}
          onClick={() => onDelete(route)}
        />
      </ConditionalWrap>
    );
  }

  const routeName = route.name === ROOT_ROUTE_NAME || !route.name ? 'Default Policy' : route.name;
  const numberOfPolicies = countPolicies(route);

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <Stack alignItems="center" gap={1} minWidth={0}>
          <Text element="h2" variant="body" weight="medium" truncate>
            {routeName}
          </Text>
        </Stack>
        {numberOfPolicies > 0 && <>{`Contains ${numberOfPolicies} polic${numberOfPolicies > 1 ? 'ies' : 'y'}`}</>}
        {provisioned && (
          <ProvisioningBadge
            tooltip
            provenance={getAnnotation(route[ROUTES_META_SYMBOL] ?? {}, K8sAnnotations.Provenance)}
          />
        )}
        <Spacer />
        <LinkButton
          tooltipPlacement="top"
          tooltip={provisioned ? 'Provisioned routing trees cannot be edited in the UI' : undefined}
          variant="secondary"
          size="sm"
          icon={canEdit ? 'pen' : 'eye'}
          type="button"
          data-testid={`${canEdit ? 'edit' : 'view'}-action`}
          href={`/alerting/routes/policy/${encodeURIComponent(route.name ?? '')}/edit`}
        >
          {canEdit ? 'Edit' : 'View'}
        </LinkButton>
        {menuActions.length > 0 && (
          <Dropdown overlay={<Menu>{menuActions}</Menu>}>
            <MoreButton data-testid="more-actions" aria-label={`More actions for routing tree "${route.name ?? ''}"`} />
          </Dropdown>
        )}
      </Stack>
      {ExportDrawer}
    </div>
  );
};

interface hasRoutes {
  routes?: hasRoutes[];
}

export function countPolicies(route: hasRoutes): number {
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
