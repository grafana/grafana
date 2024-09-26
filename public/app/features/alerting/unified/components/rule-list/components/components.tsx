import { css } from '@emotion/css';
import { groupBy, isEmpty } from 'lodash';
import { PropsWithChildren, ReactNode, useEffect } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useInterval, useMeasure, useToggle } from 'react-use';

import { GrafanaTheme2, IconName } from '@grafana/data';
import {
  Alert,
  Badge,
  Button,
  Dropdown,
  Icon,
  IconButton,
  Link,
  LoadingBar,
  Menu,
  Pagination,
  Stack,
  Text,
  TextLink,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { CombinedRuleNamespace, RulerDataSourceConfig } from 'app/types/unified-alerting';
import { PromAlertingRuleState, PromApplication, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../../../api/alertRuleApi';
import { usePagination } from '../../../hooks/usePagination';
import { RULE_LIST_POLL_INTERVAL_MS } from '../../../utils/constants';
import { makeFolderLink } from '../../../utils/misc';
import { isAlertingRulerRule, isGrafanaRulerRule, isRecordingRulerRule } from '../../../utils/rules';
import { MetaText } from '../../MetaText';
import MoreButton from '../../MoreButton';
import { Spacer } from '../../Spacer';

const GROUPS_PAGE_SIZE = 30;

const RuleList = () => {
  const styles = useStyles2(getStyles);
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();

  // 1. fetch all alerting data sources
  // 2. perform feature discovery for each
  // 3. fetch all rules for each discovered DS

  const { data, isLoading, fetch } = useFetchAllNamespacesAndGroups();
  useInterval(fetch, RULE_LIST_POLL_INTERVAL_MS);

  useEffect(() => fetch(), [fetch]);

  // in order to do decent pagination we have to flatten all of the groups again for the namespaces.
  const groups = Object.values(data)
    .flatMap((ns) => ns)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((namespace) =>
      namespace.groups.map((group) => ({
        group,
        namespace: namespace.name,
        rulesSource: namespace.rulesSource,
      }))
    );

  const { pageItems, numberOfPages, onPageChange, page } = usePagination(groups, 1, GROUPS_PAGE_SIZE);

  // TODO figure out how to get the interval for a group, make separate HTTP calls?
  const paginatedNamespaces = groupBy(pageItems, (item) => item.namespace);

  return (
    <>
      <div ref={measureRef}>{isLoading && <LoadingBar width={width} />}</div>
      <ul className={styles.rulesTree} role="tree">
        {Object.entries(paginatedNamespaces).map(([namespace, groups]) => {
          // each group in the namespace is from the same source
          const rulesSource = groups[0].rulesSource;

          const prometheusFlavour = rulesSource.buildInfo.application;

          // each rule in the groups is from the same namespace
          const folderUid = isGrafanaRulerRule(groups[0].group.rules[0])
            ? groups[0].group.rules[0]?.grafana_alert.namespace_uid
            : undefined;

          const href = folderUid ? makeFolderLink(folderUid) : undefined;

          return (
            <Namespace key={namespace + rulesSource.id} name={namespace} application={prometheusFlavour} href={href}>
              {groups.map(({ group, namespace, rulesSource }) => (
                <EvaluationGroupLoader
                  key={namespace + group.name + rulesSource.id}
                  name={group.name}
                  interval={group.interval}
                  namespace={namespace}
                  rulerConfig={rulesSource.rulerConfig}
                />
              ))}
            </Namespace>
          );
        })}
        {/* <Namespace name="Demonstrations">
          <EvaluationGroup name={'default'} interval={'5 minutes'} isOpen onToggle={() => {}}>
            <AlertRuleListItem
              state="normal"
              name={'CPU Usage'}
              summary="The CPU usage is too high – investigate immediately!"
            />
            <AlertRuleListItem state="pending" name={'Memory Usage'} summary="Memory Usage too high" />
            <AlertRuleListItem state="firing" name={'Network Usage'} summary="network congested" />
            <div className={styles.alertListItemContainer}>
              <Pagination
                hideWhenSinglePage
                currentPage={1}
                numberOfPages={5}
                onNavigate={() => {}}
                className={styles.clearFloat}
              />
            </div>
          </EvaluationGroup>

          <EvaluationGroup name={'system metrics'} interval={'1 minute'} onToggle={() => {}}>
            <AlertRuleListItem name={'email'} summary="gilles.demey@grafana.com" />
          </EvaluationGroup>
        </Namespace>

        <Namespace name="Network">
          <EvaluationGroup name={'UniFi Router'} provenance={'file'} interval={'2 minutes'}>
            <AlertRuleListItem name={'CPU Usage'} summary="doing way too much work" isProvisioned={true} />
            <AlertRuleListItem name={'Memory Usage'} isProvisioned={true} />
          </EvaluationGroup>
        </Namespace>

        <Namespace name="System Metrics">
          <EvaluationGroup name={'eu-west-1'} interval={'2 minutes'} />
          <EvaluationGroup name={'us-east-0'} interval={'5 minutes'} />
        </Namespace>

        <Namespace icon="prometheus" name=" dev-us-central-0">
          <EvaluationGroup name={'access_grafanacom'} interval={'1 minute'} />
          <EvaluationGroup name={'access_stackstateservice'} interval={'1 minute'} />
        </Namespace> */}
      </ul>
      <Pagination numberOfPages={numberOfPages} currentPage={page} onNavigate={onPageChange} hideWhenSinglePage />
    </>
  );
};

interface RulesSourceNamespace {
  name: string;
  groups: RulerRuleGroupDTO[];
  rulesSource: AlertRuleSource;
}

/**
 * This function will fetch all namespaces and groups for all configured alerting data sources.
 * It will track the namespaces and groups in a record with the datasource ID as the key.
 *
 * This way we can show duplicate namespace names and keep track of where we discovered them.
 */
// type NamespacesByDataSource = Record<string, RulesSourceNamespace[]>;
// function useFetchAllNamespacesAndGroups() {
//   const [isLoading, setLoading] = useState(false);
//   const [namespaces, setNamespaces] = useState<NamespacesByDataSource>({});

//   const alertRuleSources = useMemo(getAllRulesSourceNames, []);

//   // build an Array of lazy promises
//   const triggers = useMemo(() => {
//     return alertRuleSources.map((rulesSourceName) => async () => {
//       // memoize buildinfo
//       const buildInfo = await fetchRulesSourceBuildInfo(rulesSourceName);
//       // unable to fetch build info, skip data source
//       // TODO add support for vanilla Prometheus (data source without ruler API)
//       if (!buildInfo.rulerConfig) {
//         return;
//       }

//       const namespacesAndGroups = await fetchRulerRules(buildInfo.rulerConfig);
//       const namespacesFromSource = Object.entries(namespacesAndGroups).map(([name, groups]) => {
//         return {
//           name,
//           groups: groups.sort((a, b) => sortCaseInsensitive(a.name, b.name)),
//           rulesSource: buildInfo,
//         };
//       });

//       setNamespaces((namespaces) =>
//         produce(namespaces, (draft) => {
//           const dataSourceId = String(buildInfo.id);
//           draft[dataSourceId] = namespacesFromSource;
//         })
//       );
//     });
//   }, [alertRuleSources]);

//   const fetch = useCallback(() => {
//     setLoading(true);

//     const fetchAll = triggers.map((fn) => fn());
//     Promise.allSettled(fetchAll).finally(() => {
//       console.log('all done');
//       setLoading(false);
//     });
//   }, [setLoading, triggers]);

//   return {
//     isLoading: isLoading,
//     data: namespaces,
//     fetch,
//   };
// }

// const sortCaseInsensitive = (a: string, b: string) => a.localeCompare(b);

interface EvaluationGroupLoaderProps {
  name: string;
  interval?: string;
  provenance?: string;
  description?: ReactNode;
  namespace: string;
  rulerConfig?: RulerDataSourceConfig;
}

const ALERT_RULE_PAGE_SIZE = 15;

const EvaluationGroupLoader = ({
  name,
  description,
  provenance,
  interval,
  namespace,
  rulerConfig,
}: EvaluationGroupLoaderProps) => {
  const styles = useStyles2(getStyles);
  const [isOpen, toggle] = useToggle(false);

  // TODO fetch the state of the rule
  const [fetchRulerRuleGroup, { currentData: rulerRuleGroup, isLoading, error }] =
    alertRuleApi.endpoints.rulerRuleGroup.useLazyQuery();

  const { page, pageItems, onPageChange, numberOfPages } = usePagination(
    rulerRuleGroup?.rules ?? [],
    1,
    ALERT_RULE_PAGE_SIZE
  );

  useEffect(() => {
    if (isOpen && rulerConfig) {
      fetchRulerRuleGroup({
        rulerConfig,
        namespace,
        group: name,
      });
    }
  }, [fetchRulerRuleGroup, isOpen, name, namespace, rulerConfig]);

  return (
    <EvaluationGroup
      name={name}
      description={description}
      interval={interval}
      provenance={provenance}
      isOpen={isOpen}
      onToggle={toggle}
    >
      <>
        {error && (
          <div className={styles.alertListItemContainer}>
            <Alert title="Something went wrong when trying to fetch group details">{String(error)}</Alert>
          </div>
        )}
        {isLoading ? (
          <GroupLoadingIndicator />
        ) : (
          pageItems.map((rule, index) => {
            if (isAlertingRulerRule(rule)) {
              return (
                <AlertRuleListItem
                  key={index}
                  state="normal"
                  name={rule.alert}
                  href={'/'}
                  summary={rule.annotations?.summary}
                />
              );
            }

            if (isRecordingRulerRule(rule)) {
              return <RecordingRuleListItem key={index} name={rule.record} href={'/'} />;
            }

            if (isGrafanaRulerRule(rule)) {
              return (
                <AlertRuleListItem
                  key={index}
                  name={rule.grafana_alert.title}
                  href={'/'}
                  summary={rule.annotations?.summary}
                  isProvisioned={Boolean(rule.grafana_alert.provenance)}
                />
              );
            }

            return null;
          })
        )}
        {numberOfPages > 1 && (
          <div className={styles.alertListItemContainer}>
            <Pagination
              currentPage={page}
              numberOfPages={numberOfPages}
              onNavigate={onPageChange}
              className={styles.clearFloat}
            />
          </div>
        )}
      </>
    </EvaluationGroup>
  );
};

interface EvaluationGroupProps extends PropsWithChildren {
  name: string;
  description?: ReactNode;
  interval?: string;
  provenance?: string;
  isOpen?: boolean;
  onToggle: () => void;
}

export const EvaluationGroup = ({
  name,
  description,
  provenance,
  interval,
  onToggle,
  isOpen = false,
  children,
}: EvaluationGroupProps) => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.groupWrapper} role="treeitem" aria-expanded={isOpen} aria-selected="false">
      <EvaluationGroupHeader
        onToggle={onToggle}
        provenance={provenance}
        isOpen={isOpen}
        description={description}
        name={name}
        interval={interval}
      />
      {isOpen && <div role="group">{children}</div>}
    </div>
  );
};

const GroupLoadingIndicator = () => {
  const [ref, { width }] = useMeasure<HTMLDivElement>();

  return (
    <div ref={ref}>
      <LoadingBar width={width} />
      <SkeletonListItem />
    </div>
  );
};

const SkeletonListItem = () => {
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems="flex-start" gap={1}>
        <Skeleton width={16} height={16} circle />
        <Stack direction="row" alignItems={'center'} gap={1} flex="1">
          <Stack direction="column" gap={0.5}>
            <div>
              <Skeleton height={16} width={350} />
            </div>
            <div>
              <Skeleton height={10} width={200} />
            </div>
          </Stack>
        </Stack>
      </Stack>
    </li>
  );
};

const EvaluationGroupHeader = (props: EvaluationGroupProps) => {
  const { name, description, provenance, interval, isOpen = false, onToggle } = props;

  const styles = useStyles2(getStyles);
  const isProvisioned = Boolean(provenance);

  return (
    <div className={styles.headerWrapper}>
      <Stack direction="row" alignItems="center" gap={1}>
        <button className={styles.hiddenButton} type="button" onClick={onToggle}>
          <Stack alignItems="center" gap={1}>
            <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
            <Text truncate variant="body">
              {name}
            </Text>
          </Stack>
        </button>
        {isProvisioned && <Badge color="purple" text="Provisioned" />}
        {description && <MetaText>{description}</MetaText>}
        <Spacer />
        {interval && (
          <MetaText>
            <Icon name={'history'} size="sm" />
            {interval}
            <span>·</span>
          </MetaText>
        )}
        <Button
          variant="secondary"
          size="sm"
          icon="pen"
          type="button"
          disabled={isProvisioned}
          aria-label="edit-group-action"
          data-testid="edit-group-action"
        >
          Edit
        </Button>
        <Dropdown
          overlay={
            <Menu>
              <Menu.Item label="Re-order rules" icon="flip" disabled={isProvisioned} />
              <Menu.Divider />
              <Menu.Item label="Export" icon="download-alt" />
              <Menu.Item label="Delete" icon="trash-alt" destructive disabled={isProvisioned} />
            </Menu>
          }
        >
          <MoreButton />
        </Dropdown>
      </Stack>
    </div>
  );
};

interface RecordingRuleListItemProps {
  name: string;
  href: string;
  error?: string;
  isProvisioned?: boolean;
}

const RecordingRuleListItem = ({ name, error, isProvisioned, href }: RecordingRuleListItemProps) => {
  const styles = useStyles2(getStyles);

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems={'center'} gap={1}>
        <Icon name="record-audio" size="lg" />
        <Stack direction="row" alignItems={'center'} gap={1} flex="1">
          <Stack direction="column" gap={0.5}>
            <div>
              <Stack direction="column" gap={0}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Link href={href}>
                    <Text truncate variant="body" color="link" weight="bold">
                      {name}
                    </Text>
                  </Link>
                </Stack>
              </Stack>
            </div>
            <div>
              <Stack direction="row" gap={1}>
                {error ? (
                  <>
                    {/* TODO we might need an error variant for MetaText, dito for success */}
                    {/* TODO show error details on hover or elsewhere */}
                    <Text color="error" variant="bodySmall" weight="bold">
                      <Stack direction="row" alignItems={'center'} gap={0.5}>
                        <Tooltip
                          content={
                            'failed to send notification to email addresses: gilles.demey@grafana.com: dial tcp 192.168.1.21:1025: connect: connection refused'
                          }
                        >
                          <span>
                            <Icon name="exclamation-circle" /> Last delivery attempt failed
                          </span>
                        </Tooltip>
                      </Stack>
                    </Text>
                  </>
                ) : (
                  <></>
                )}
              </Stack>
            </div>
          </Stack>
          <Spacer />
          <Button
            variant="secondary"
            size="sm"
            icon="edit"
            type="button"
            disabled={isProvisioned}
            aria-label="edit-rule-action"
            data-testid="edit-rule-action"
          >
            Edit
          </Button>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item label="Export" disabled={isProvisioned} icon="download-alt" />
                <Menu.Item label="Delete" disabled={isProvisioned} icon="trash-alt" destructive />
              </Menu>
            }
          >
            <Button
              variant="secondary"
              size="sm"
              icon="ellipsis-h"
              type="button"
              aria-label="more-rule-actions"
              data-testid="more-rule-actions"
            />
          </Dropdown>
        </Stack>
      </Stack>
    </li>
  );
};

interface AlertRuleListItemProps {
  name: string;
  href: string;
  summary?: string;
  error?: string;
  state?: PromAlertingRuleState;
  isProvisioned?: boolean;
  groupName?: string;
  namespace?: CombinedRuleNamespace;
}

export const AlertRuleListItem = (props: AlertRuleListItemProps) => {
  const { name, summary, state, error, href, isProvisioned, groupName, namespace } = props;
  const hasRuleLocation = namespace && groupName; // can be empty if we are using this component in the hierarchical view

  const styles = useStyles2(getStyles);

  const icons: Record<PromAlertingRuleState, IconName> = {
    [PromAlertingRuleState.Inactive]: 'check',
    [PromAlertingRuleState.Pending]: 'hourglass',
    [PromAlertingRuleState.Firing]: 'exclamation-circle',
  };

  const color: Record<PromAlertingRuleState, 'success' | 'error' | 'warning'> = {
    [PromAlertingRuleState.Inactive]: 'success',
    [PromAlertingRuleState.Pending]: 'warning',
    [PromAlertingRuleState.Firing]: 'error',
  };

  return (
    <li className={styles.alertListItemContainer} role="treeitem" aria-selected="false">
      <Stack direction="row" alignItems="start" gap={1} wrap={false}>
        <Text color={state ? color[state] : 'secondary'}>
          <Icon name={state ? icons[state] : 'circle'} size="lg" />
        </Text>
        <Stack direction="column" gap={0.5} flex="1">
          <div>
            <Stack direction="column" gap={0}>
              <TextLink href={href} inline={false}>
                {name}
              </TextLink>
              {summary && (
                <Text variant="bodySmall" color="secondary">
                  {summary}
                </Text>
              )}
            </Stack>
          </div>
          <div>
            <Stack direction="row" gap={1}>
              {error ? (
                <>
                  {/* TODO we might need an error variant for MetaText, dito for success */}
                  {/* TODO show error details on hover or elsewhere */}
                  <Text color="error" variant="bodySmall">
                    <Stack direction="row" alignItems={'center'} gap={0.5}>
                      <Text truncate>{error}</Text>
                    </Stack>
                  </Text>
                </>
              ) : (
                <>
                  {hasRuleLocation && (
                    <Text color="secondary" variant="bodySmall">
                      <RuleLocation namespace={namespace} group={groupName} />
                    </Text>
                  )}
                  <MetaText icon="clock-nine">
                    Firing for <Text color="primary">2m 34s</Text>
                  </MetaText>
                  <MetaText icon="hourglass">
                    Next evaluation in <Text color="primary">34s</Text>
                  </MetaText>
                </>
              )}
            </Stack>
          </div>
        </Stack>

        <Stack direction="row" alignItems="center" gap={1} wrap={false}>
          <MetaText icon="layer-group">9</MetaText>
          <Button
            variant="secondary"
            size="sm"
            icon="edit"
            type="button"
            disabled={isProvisioned}
            aria-label="edit-rule-action"
            data-testid="edit-rule-action"
          >
            Edit
          </Button>
          <Dropdown
            overlay={
              <Menu>
                <Menu.Item label="Silence" icon="bell-slash" />
                <Menu.Divider />
                <Menu.Item label="Export" disabled={isProvisioned} icon="download-alt" />
                <Menu.Item label="Delete" disabled={isProvisioned} icon="trash-alt" destructive />
              </Menu>
            }
          >
            <Button
              variant="secondary"
              size="sm"
              icon="ellipsis-h"
              type="button"
              aria-label="more-rule-actions"
              data-testid="more-rule-actions"
            />
          </Dropdown>
        </Stack>
      </Stack>
    </li>
  );
};

interface NamespaceProps extends PropsWithChildren {
  name: ReactNode;
  href?: string;
  application?: PromApplication | 'Grafana';
  collapsed?: boolean;
}

// TODO hook up buttons
export const Namespace = ({ children, name, href, application, collapsed = false }: NamespaceProps) => {
  const styles = useStyles2(getStyles);
  const [isCollapsed, toggleCollapsed] = useToggle(collapsed);

  const genericApplicationIcon = application === 'Grafana';

  return (
    <li className={styles.namespaceWrapper} role="treeitem" aria-selected="false">
      <div className={styles.namespaceTitle}>
        <Stack alignItems={'center'}>
          <Stack alignItems={'center'} gap={1}>
            <IconButton
              name={isCollapsed ? 'angle-right' : 'angle-down'}
              onClick={toggleCollapsed}
              aria-label="collapse namespace"
            />
            {application === PromApplication.Prometheus && (
              <img
                width={16}
                height={16}
                src="/public/app/plugins/datasource/prometheus/img/prometheus_logo.svg"
                alt="Prometheus"
              />
            )}
            {application === PromApplication.Mimir && (
              <img
                width={16}
                height={16}
                src="/public/app/plugins/datasource/prometheus/img/mimir_logo.svg"
                alt="Mimir"
              />
            )}
            {genericApplicationIcon && <Icon name="folder" />}
            {href && typeof name === 'string' ? (
              <Link href={href}>
                <Text truncate color="link">
                  {name}
                </Text>
              </Link>
            ) : (
              name
            )}
          </Stack>
          <Spacer />
          <Button variant="secondary" size="sm" icon="unlock" type="button" aria-label="edit permissions">
            Edit permissions
          </Button>
        </Stack>
      </div>
      {!isEmpty(children) && !isCollapsed && (
        <ul role="group" className={styles.groupItemsWrapper}>
          {children}
        </ul>
      )}
    </li>
  );
};

interface RuleLocationProps {
  namespace: CombinedRuleNamespace;
  group: string;
}

const RuleLocation = ({ namespace, group }: RuleLocationProps) => (
  <Stack direction="row" alignItems="center" gap={0.5}>
    <Icon size="xs" name="folder" />
    <Stack direction="row" alignItems="center" gap={0}>
      {namespace.name}
      <Icon size="sm" name="angle-right" />
      {group}
    </Stack>
  </Stack>
);

const getStyles = (theme: GrafanaTheme2) => ({
  rulesTree: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  groupWrapper: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  groupItemsWrapper: css({
    position: 'relative',
    borderRadius: theme.shape.radius.default,
    border: `solid 1px ${theme.colors.border.weak}`,
    borderBottom: 'none',

    marginLeft: theme.spacing(3),

    '&:before': {
      content: "''",
      position: 'absolute',
      height: '100%',

      borderLeft: `solid 1px ${theme.colors.border.weak}`,

      marginTop: 0,
      marginLeft: `-${theme.spacing(2.5)}`,
    },
  }),
  alertListItemContainer: css({
    position: 'relative',
    listStyle: 'none',
    background: theme.colors.background.primary,

    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,
  }),
  headerWrapper: css({
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    background: theme.colors.background.secondary,

    border: 'none',
    borderBottom: `solid 1px ${theme.colors.border.weak}`,
    borderTopLeftRadius: theme.shape.radius.default,
    borderTopRightRadius: theme.shape.radius.default,
  }),
  namespaceWrapper: css({
    display: 'flex',
    flexDirection: 'column',

    gap: theme.spacing(1),
  }),
  namespaceTitle: css({
    padding: `${theme.spacing(1)} ${theme.spacing(1.5)}`,

    background: theme.colors.background.secondary,

    border: `solid 1px ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  hiddenButton: css({
    border: 'none',
    background: 'transparent',
  }),
  clearFloat: css({
    float: 'none',
  }),
});

export default RuleList;
