import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { base64UrlEncode } from '@grafana/alerting';
import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, Button, Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';
import { type AlertmanagerConfig } from 'app/plugins/datasource/alertmanager/types';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeEditContactPointLink, makeEditTimeIntervalLink } from '../../utils/misc';
import { createRelativeUrl } from '../../utils/url';

import { RevertConfirmModal } from './RevertConfirmModal';
import {
  type StagedExtraConfig,
  encodeRouteMatchersQuery,
  getReceiverIntegrationTypes,
  getTimeIntervalNames,
  parseStagedAlertmanagerConfig,
  resolveMergedNames,
  summarizeMatchRecord,
  summarizeRouteMatchers,
  summarizeStagedConfig,
} from './stagedConfig';

const GRAFANA_AM = { alertmanager: GRAFANA_RULES_SOURCE_NAME };

// Contact points are k8s resources addressed by a UID that is the base64url encoding of their name,
// so we derive it to deep-link into the (read-only) contact point view page.
function makeViewContactPointLink(name: string): string {
  return makeEditContactPointLink(base64UrlEncode(name), GRAFANA_AM);
}

// Time intervals (mute timings) are addressed by their raw name in the edit route.
function makeViewTimeIntervalLink(name: string): string {
  return makeEditTimeIntervalLink(name, GRAFANA_AM);
}

// Templates are addressed by a hashed UID that can't be derived from the name, so we link to the
// templates list where the imported template appears (read-only) rather than a per-item detail page.
function makeViewTemplatesLink(): string {
  return createRelativeUrl('/alerting/notifications/templates', GRAFANA_AM);
}

/**
 * Filter the notification policies page to the staged config's own routing tree — the staged import is
 * exposed as a managed tree named after the config identifier — and, when there are matchers, to a single
 * policy within it. Without `includeTree` the page lists every tree, live ones included.
 */
function makeViewPolicyLink(treeName: string, matchers: string): string {
  return createRelativeUrl('/alerting/routes', {
    ...GRAFANA_AM,
    includeTree: treeName,
    ...(matchers ? { queryString: matchers } : {}),
  });
}

interface AccordionSection {
  key: string;
  icon: IconName;
  label: string;
  count: number;
  content: React.ReactNode;
}

interface Props {
  stagedConfig: StagedExtraConfig;
  /** Whether the current user can discard the staged configuration. */
  canRevert: boolean;
  /** Written by the external Alertmanager sync, so reverting it would only be undone by the next tick. */
  isSyncManaged?: boolean;
  /**
   * The live Grafana Alertmanager config the staged one is merged against. Needed to work out which staged
   * resources the backend renames on a name collision, so their View links address the staged copy.
   */
  liveConfig?: AlertmanagerConfig;
}

export function StagedConfiguration({ stagedConfig, canRevert, isSyncManaged, liveConfig }: Props) {
  const styles = useStyles2(getStyles);
  const [showRevertModal, setShowRevertModal] = useState(false);
  const noPermissionTooltip = t(
    'alerting.settings.import.no-write-permission',
    "You don't have permission to modify the imported configuration."
  );
  const config = parseStagedAlertmanagerConfig(stagedConfig.alertmanager_config);

  if (!config) {
    return (
      <Alert
        severity="error"
        title={t('alerting.settings.import.parse-error-title', "Couldn't read the staged configuration")}
      >
        <Trans i18nKey="alerting.settings.import.parse-error-body">
          The imported Alertmanager configuration could not be parsed.
        </Trans>
      </Alert>
    );
  }

  const summary = summarizeStagedConfig(config, stagedConfig.template_files);
  const receivers = config.receivers ?? [];
  const childRoutes = config.route?.routes ?? [];
  const inhibitRules = config.inhibit_rules ?? [];

  // Link targets, which are the post-merge names — they differ from the labels below (the staged config's
  // own names) whenever a staged resource collides with a live one.
  const receiverLinkNames = resolveMergedNames(
    summary.receivers,
    (liveConfig?.receivers ?? []).map((receiver) => receiver.name),
    stagedConfig.identifier
  );
  const timeIntervalLinkNames = resolveMergedNames(
    summary.timeIntervals,
    liveConfig ? getTimeIntervalNames(liveConfig) : [],
    stagedConfig.identifier
  );

  const sections: AccordionSection[] = [];

  if (receivers.length > 0) {
    sections.push({
      key: 'contact-points',
      icon: 'comment-alt',
      label: t('alerting.settings.import.section.contact-points', 'Contact points'),
      count: receivers.length,
      content: receivers.map((receiver, index) => (
        <ResourceRow
          key={receiverLinkNames[index]}
          label={receiver.name}
          meta={getReceiverIntegrationTypes(receiver).join(', ')}
          href={makeViewContactPointLink(receiverLinkNames[index])}
        />
      )),
    });
  }

  if (summary.hasRoutingTree) {
    sections.push({
      key: 'notification-policy',
      icon: 'sitemap',
      // One import contributes exactly one routing tree — the backend adds it as a managed route named after
      // the identifier rather than merging it into the default policy.
      label: t('alerting.settings.import.section.notification-policy', 'Notification policy'),
      count: 1,
      content: (
        <>
          <ResourceRow
            label={stagedConfig.identifier}
            meta={<RoutingTreeMeta receiver={config.route?.receiver} routeCount={childRoutes.length} />}
            href={makeViewPolicyLink(stagedConfig.identifier, '')}
          />
          {childRoutes.map((route, index) => {
            const matchers = summarizeRouteMatchers(route);
            return (
              <ResourceRow
                key={`${matchers}|${route.receiver ?? ''}|${index}`}
                indented
                label={matchers || t('alerting.settings.import.no-matchers', '(no matchers)')}
                meta={route.receiver ? `→ ${route.receiver}` : undefined}
                href={makeViewPolicyLink(stagedConfig.identifier, encodeRouteMatchersQuery(route))}
              />
            );
          })}
        </>
      ),
    });
  }

  if (summary.templates.length > 0) {
    sections.push({
      key: 'templates',
      icon: 'file-alt',
      label: t('alerting.settings.import.section.templates', 'Templates'),
      count: summary.templates.length,
      content: summary.templates.map((name) => <ResourceRow key={name} label={name} href={makeViewTemplatesLink()} />),
    });
  }

  if (summary.timeIntervals.length > 0) {
    sections.push({
      key: 'time-intervals',
      icon: 'history',
      label: t('alerting.settings.import.section.time-intervals', 'Time intervals'),
      count: summary.timeIntervals.length,
      content: summary.timeIntervals.map((name, index) => (
        <ResourceRow
          key={timeIntervalLinkNames[index]}
          label={name}
          href={makeViewTimeIntervalLink(timeIntervalLinkNames[index])}
        />
      )),
    });
  }

  if (inhibitRules.length > 0) {
    sections.push({
      key: 'inhibition-rules',
      icon: 'shield',
      label: t('alerting.settings.import.section.inhibition-rules', 'Inhibition rules'),
      count: inhibitRules.length,
      // Inhibition rules are raw Alertmanager config with no dedicated management page, so we show
      // their details inline (source → target, and the labels that must be equal) rather than a link.
      content: inhibitRules.map((rule, index) => {
        const source = summarizeMatchRecord(rule.source_match, rule.source_match_re, rule.source_matchers);
        const target = summarizeMatchRecord(rule.target_match, rule.target_match_re, rule.target_matchers);
        return (
          <div key={`${source}|${target}|${index}`} className={styles.row}>
            <span className={styles.mono}>{source || t('alerting.settings.import.any', 'any')}</span>
            <Icon name="arrow-right" size="sm" />
            <span className={styles.mono}>{target || t('alerting.settings.import.any', 'any')}</span>
            {rule.equal?.length ? (
              <span className={styles.meta}>
                <Trans i18nKey="alerting.settings.import.inhibition-equal" values={{ labels: rule.equal.join(', ') }}>
                  equal: {'{{labels}}'}
                </Trans>
              </span>
            ) : null}
          </div>
        );
      }),
    });
  }

  return (
    <div className={styles.card}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1} wrap="wrap">
        <Stack direction="row" alignItems="center" gap={1}>
          <Text element="h3" variant="h5">
            {stagedConfig.identifier}
          </Text>
          {isSyncManaged ? (
            <Badge color="green" icon="sync" text={t('alerting.settings.import.synced-badge', 'Synced · read-only')} />
          ) : (
            <Badge
              color="blue"
              icon="cloud-upload"
              text={t('alerting.settings.import.staged-badge', 'Staged · read-only')}
            />
          )}
        </Stack>
        {!isSyncManaged && (
          <Button
            variant="secondary"
            disabled={!canRevert}
            tooltip={canRevert ? undefined : noPermissionTooltip}
            onClick={() => setShowRevertModal(true)}
          >
            <Trans i18nKey="alerting.settings.import.revert-button">Revert</Trans>
          </Button>
        )}
      </Stack>

      {isSyncManaged && (
        <Text variant="bodySmall" color="secondary">
          <Trans i18nKey="alerting.settings.import.sync-managed-description">
            This configuration is kept up to date by auto-sync, so it can&apos;t be reverted — disable auto-sync to
            remove it.
          </Trans>
        </Text>
      )}

      <ResourceAccordion sections={sections} />

      {showRevertModal && (
        <RevertConfirmModal stagedConfig={stagedConfig} onDismiss={() => setShowRevertModal(false)} />
      )}
    </div>
  );
}

interface RoutingTreeMetaProps {
  /** Nullable to match `Route['receiver']`, which the Alertmanager config may omit or null out. */
  receiver?: string | null;
  routeCount: number;
}

/**
 * Contact point and size of the imported routing tree. Counts direct children only, matching what the
 * notification policies page shows for the tree, so the number doesn't change when View is followed.
 */
function RoutingTreeMeta({ receiver, routeCount }: RoutingTreeMetaProps) {
  const receiverPrefix = receiver ? `→ ${receiver} · ` : '';
  return (
    <>
      {receiverPrefix}
      <Trans
        i18nKey="alerting.settings.import.policy-tree-routes"
        count={routeCount}
        tOptions={{ defaultValue_one: '{{count}} route', defaultValue_other: '{{count}} routes' }}
      >
        {'{{count}}'} route
      </Trans>
    </>
  );
}

interface ResourceRowProps {
  label: string;
  meta?: React.ReactNode;
  href?: string;
  /** Mark the row as a sub-policy of the row above it. */
  indented?: boolean;
}

function ResourceRow({ label, meta, href, indented }: ResourceRowProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={cx(styles.row, indented && styles.childRow)}>
      <span className={styles.mono}>{label}</span>
      {meta && <span className={styles.meta}>{meta}</span>}
      <span className={styles.spacer} />
      {href && (
        <LinkButton href={href} variant="secondary" size="sm" icon="eye">
          {t('alerting.settings.import.view', 'View')}
        </LinkButton>
      )}
    </div>
  );
}

function ResourceAccordion({ sections }: { sections: AccordionSection[] }) {
  const styles = useStyles2(getStyles);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const allOpen = sections.length > 0 && sections.every((section) => openKeys.has(section.key));

  const toggleAll = () => {
    setOpenKeys(allOpen ? new Set() : new Set(sections.map((section) => section.key)));
  };

  const toggle = (key: string) => {
    setOpenKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <Stack direction="column" gap={1}>
      <div className={styles.resourcesHeader}>
        <Text variant="bodySmall" color="secondary" weight="medium">
          <Trans i18nKey="alerting.settings.import.resources">Resources</Trans>
        </Text>
        <Button
          variant="secondary"
          fill="outline"
          size="sm"
          icon={allOpen ? 'angle-up' : 'angle-down'}
          onClick={toggleAll}
        >
          {allOpen ? (
            <Trans i18nKey="alerting.settings.import.collapse-all">Collapse all</Trans>
          ) : (
            <Trans i18nKey="alerting.settings.import.expand-all">Expand all</Trans>
          )}
        </Button>
      </div>

      {sections.map((section) => {
        const isOpen = openKeys.has(section.key);
        const headerId = `staged-section-${section.key}-header`;
        const contentId = `staged-section-${section.key}-content`;
        return (
          <div key={section.key} className={styles.section}>
            <button
              type="button"
              id={headerId}
              className={styles.sectionHeader}
              aria-expanded={isOpen}
              aria-controls={contentId}
              onClick={() => toggle(section.key)}
            >
              <Icon name={section.icon} size="sm" />
              <Text variant="bodySmall" weight="medium">
                {section.label}
              </Text>
              <span className={styles.count}>{section.count}</span>
              <span className={styles.spacer} />
              <Icon name={isOpen ? 'angle-down' : 'angle-right'} />
            </button>
            {isOpen && (
              <div id={contentId} role="region" aria-labelledby={headerId} className={styles.sectionContent}>
                {section.content}
              </div>
            )}
          </div>
        );
      })}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  card: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(2),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
  }),
  resourcesHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
  }),
  section: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  sectionHeader: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    padding: theme.spacing(1, 1.5),
    background: theme.colors.background.secondary,
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    color: theme.colors.text.primary,
  }),
  sectionContent: css({
    display: 'flex',
    flexDirection: 'column',
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1, 1.5),
    borderTop: `1px solid ${theme.colors.border.weak}`,
    '&:first-child': {
      borderTop: 'none',
    },
  }),
  childRow: css({
    position: 'relative',
    paddingLeft: theme.spacing(4),
    '&::before': {
      content: '""',
      position: 'absolute',
      left: theme.spacing(2),
      top: 0,
      bottom: 0,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      left: theme.spacing(2),
      top: '50%',
      width: theme.spacing(1),
      borderTop: `1px solid ${theme.colors.border.weak}`,
    },
  }),
  mono: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
  }),
  meta: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  count: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
  }),
  spacer: css({
    flex: 1,
  }),
});
