import { css } from '@emotion/css';
import { useState } from 'react';

import { base64UrlEncode } from '@grafana/alerting';
import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Alert, Badge, Button, Icon, LinkButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { makeEditContactPointLink, makeEditTimeIntervalLink } from '../../utils/misc';
import { createRelativeUrl } from '../../utils/url';

import {
  type StagedExtraConfig,
  getReceiverIntegrationTypes,
  parseStagedAlertmanagerConfig,
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

/** Filter the notification policies tree to a policy by its matchers; unfiltered when there are none. */
function makeViewPolicyLink(matchers: string): string {
  return createRelativeUrl('/alerting/routes', matchers ? { queryString: matchers } : {});
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
}

export function StagedConfiguration({ stagedConfig }: Props) {
  const styles = useStyles2(getStyles);
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

  const sections: AccordionSection[] = [];

  if (receivers.length > 0) {
    sections.push({
      key: 'contact-points',
      icon: 'comment-alt',
      label: t('alerting.settings.import.section.contact-points', 'Contact points'),
      count: receivers.length,
      content: receivers.map((receiver) => (
        <ResourceRow
          key={receiver.name}
          label={receiver.name}
          meta={getReceiverIntegrationTypes(receiver).join(', ')}
          href={makeViewContactPointLink(receiver.name)}
        />
      )),
    });
  }

  if (summary.hasRoutingTree) {
    sections.push({
      key: 'notification-policies',
      icon: 'sitemap',
      label: t('alerting.settings.import.section.notification-policies', 'Notification policies'),
      // Root "Default policy" row + the direct child routes we render below (nested routes aren't listed).
      count: childRoutes.length + 1,
      content: (
        <>
          <ResourceRow
            label={t('alerting.settings.import.default-policy', 'Default policy')}
            plainLabel
            meta={config.route?.receiver ?? undefined}
            href={makeViewPolicyLink('')}
          />
          {childRoutes.map((route, index) => {
            const matchers = summarizeRouteMatchers(route);
            return (
              <ResourceRow
                key={`${matchers}|${route.receiver ?? ''}|${index}`}
                label={matchers || t('alerting.settings.import.no-matchers', '(no matchers)')}
                meta={route.receiver ? `→ ${route.receiver}` : undefined}
                href={makeViewPolicyLink(matchers)}
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
      content: summary.timeIntervals.map((name) => (
        <ResourceRow key={name} label={name} href={makeViewTimeIntervalLink(name)} />
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
      <Stack direction="row" alignItems="center" gap={1}>
        <Text element="h3" variant="h5">
          {stagedConfig.identifier}
        </Text>
        <Badge
          color="blue"
          icon="cloud-upload"
          text={t('alerting.settings.import.staged-badge', 'Staged · read-only')}
        />
      </Stack>
      <ResourceAccordion sections={sections} />
    </div>
  );
}

interface ResourceRowProps {
  label: string;
  meta?: string;
  href?: string;
  /** Render the label in the default font instead of monospace (used for the "Default policy" row). */
  plainLabel?: boolean;
}

function ResourceRow({ label, meta, href, plainLabel }: ResourceRowProps) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.row}>
      <span className={plainLabel ? styles.plainLabel : styles.mono}>{label}</span>
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
  mono: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
  }),
  plainLabel: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
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
