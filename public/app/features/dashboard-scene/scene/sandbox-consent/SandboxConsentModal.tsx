import { css } from '@emotion/css';
import { useState } from 'react';

import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Checkbox, Icon, Modal, ScrollContainer, Stack, Tag, Text, Tooltip, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';

import { ALWAYS_ALLOW_DAYS, allowOrigins, type BlockedOriginSummary, type ConsentScope } from './sandboxConsent';

// In theme spacing units, about six URLs. A long list scrolls so it can't push the other sources out of view.
const URL_LIST_HEIGHT = 18;

interface Props {
  dashboardUid?: string;
  sources: BlockedOriginSummary[];
  onDismiss: () => void;
}

export function SandboxConsentModal({ dashboardUid, sources, onDismiss }: Props) {
  const styles = useStyles2(getStyles);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  // A source with URLs left out can't be reviewed, so it can't be allowed.
  const allowable = sources.filter((source) => !source.truncated);
  const selected = allowable.filter((source) => checked.has(source.origin));
  const allSelected = allowable.length > 0 && selected.length === allowable.length;

  const toggle = (origin: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (!next.delete(origin)) {
        next.add(origin);
      }
      return next;
    });

  const allow = (scope: ConsentScope) => {
    allowOrigins(selected, scope, dashboardUid);
    const count = selected.length;
    appEvents.emit(AppEvents.alertSuccess, [
      scope === 'always'
        ? t('dashboard-scene.sandbox-consent.allowed-always', '', {
            count,
            days: ALWAYS_ALLOW_DAYS,
            defaultValue_one: '{{count}} source is now allowed for {{days}} days',
            defaultValue_other: '{{count}} sources are now allowed for {{days}} days',
          })
        : t('dashboard-scene.sandbox-consent.allowed-panels', '', {
            count,
            defaultValue_one: '{{count}} source is now allowed in the panels listed',
            defaultValue_other: '{{count}} sources are now allowed in the panels listed',
          }),
    ]);
    onDismiss();
  };

  return (
    <Modal title={t('dashboard-scene.sandbox-consent.modal-title', 'Blocked resources')} isOpen onDismiss={onDismiss}>
      <div className={styles.selectAll}>
        <Checkbox
          label={t('dashboard-scene.sandbox-consent.select-all', 'Select all')}
          value={allSelected}
          indeterminate={selected.length > 0 && !allSelected}
          disabled={allowable.length === 0}
          onChange={() => setChecked(allSelected ? new Set() : new Set(allowable.map((source) => source.origin)))}
        />
      </div>
      <ul className={styles.list}>
        {sources.map((source) => (
          <li key={source.origin} className={styles.row}>
            <Checkbox
              aria-label={source.host}
              value={!source.truncated && checked.has(source.origin)}
              disabled={source.truncated}
              onChange={() => toggle(source.origin)}
            />
            <Stack gap={1} alignItems="center" wrap="wrap">
              <Text weight="medium">{source.host}</Text>
              {source.panels
                .filter((panel) => panel !== '')
                .map((panel) => (
                  <Tag key={panel} name={panel} />
                ))}
            </Stack>
            <div className={styles.details}>
              <Text variant="bodySmall" color="secondary">
                {sourceSummary(source)}
              </Text>
              {source.urls.length > 0 && (
                // Show every URL in full. A hidden or cut-off URL could be the one leaking data.
                <ScrollContainer
                  maxHeight={URL_LIST_HEIGHT}
                  showScrollIndicators
                  borderStyle="solid"
                  borderColor="weak"
                  borderRadius="default"
                  paddingX={1}
                  paddingY={0.5}
                >
                  {source.urls.map(({ url, count }) => (
                    <div key={url} className={styles.url}>
                      {url}
                      {count > 1 && (
                        <span className={styles.urlRepeats}>
                          {t('dashboard-scene.sandbox-consent.url-repeats', '×{{times}}', { times: count })}
                        </span>
                      )}
                    </div>
                  ))}
                </ScrollContainer>
              )}
              {source.truncated && (
                <Text variant="bodySmall" color="warning">
                  {t(
                    'dashboard-scene.sandbox-consent.truncated',
                    "Too many resources to review. This source can't be allowed."
                  )}
                </Text>
              )}
            </div>
          </li>
        ))}
      </ul>
      <Modal.ButtonRow>
        <Button variant="secondary" disabled={selected.length === 0} onClick={() => allow('dashboard')}>
          <ButtonLabel
            label={t('dashboard-scene.sandbox-consent.allow', 'Allow')}
            tooltip={t(
              'dashboard-scene.sandbox-consent.allow-tooltip',
              'Load content from the selected sources in the panels listed, until you close this tab.'
            )}
          />
        </Button>
        <Button variant="primary" disabled={selected.length === 0} onClick={() => allow('always')}>
          <ButtonLabel
            label={t('dashboard-scene.sandbox-consent.always-allow', 'Always allow')}
            tooltip={t(
              'dashboard-scene.sandbox-consent.always-allow-tooltip',
              'Load content from the selected sources on any dashboard for {{days}} days. Saved in this browser.',
              { days: ALWAYS_ALLOW_DAYS }
            )}
          />
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

/** `atLeast` adds a "+" when some resources weren't listed, and so weren't counted. */
export function resourcesLabel(count: number, atLeast = false) {
  return atLeast
    ? t('dashboard-scene.sandbox-consent.resources-at-least', '', {
        count,
        defaultValue_one: '{{count}}+ resource',
        defaultValue_other: '{{count}}+ resources',
      })
    : t('dashboard-scene.sandbox-consent.resources', '', {
        count,
        defaultValue_one: '{{count}} resource',
        defaultValue_other: '{{count}} resources',
      });
}

// "3 resources", or "3 resources from 1 URL" when some URLs are used more than once.
function sourceSummary({ count, urls, truncated }: BlockedOriginSummary) {
  const resources = resourcesLabel(count, truncated);
  if (urls.length === 0 || urls.length === count) {
    return resources;
  }
  return t('dashboard-scene.sandbox-consent.resources-from-urls', '{{resources}} from {{urls}}', {
    resources,
    urls: t('dashboard-scene.sandbox-consent.url-count', '', {
      count: urls.length,
      defaultValue_one: '{{count}} URL',
      defaultValue_other: '{{count}} URLs',
    }),
  });
}

function ButtonLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Stack gap={0.5} alignItems="center">
      {label}
      <Tooltip content={tooltip}>
        <Icon name="info-circle" />
      </Tooltip>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  selectAll: css({
    paddingBottom: theme.spacing(1),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  row: css({
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr)',
    columnGap: theme.spacing(1.5),
    rowGap: theme.spacing(0.5),
    // Centers the checkbox on the host line, which the panel tags make taller.
    alignItems: 'center',
    padding: theme.spacing(1.5, 0),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  details: css({
    gridColumn: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    minWidth: 0,
  }),
  url: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    overflowWrap: 'anywhere',
  }),
  urlRepeats: css({
    marginLeft: theme.spacing(1),
    color: theme.colors.text.primary,
    whiteSpace: 'nowrap',
  }),
});
