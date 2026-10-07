import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Badge, type BadgeColor, Button, Checkbox, Modal, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';

import {
  allowHosts,
  type AllowScope,
  type BlockedResource,
  groupByHost,
  resetAllowedHosts,
  useImageGuardState,
} from './imageGuardStore';

const VISIBLE_URLS = 2;

const PANEL_BADGE_COLORS: BadgeColor[] = ['blue', 'purple', 'green', 'orange', 'red', 'brand'];

/** Gives each panel one color, so it reads the same on every row it appears in. */
function getPanelColors(resources: BlockedResource[]): Map<string, BadgeColor> {
  const colors = new Map<string, BadgeColor>();
  for (const title of resources.flatMap((r) => r.panelTitles)) {
    if (!colors.has(title)) {
      colors.set(title, PANEL_BADGE_COLORS[colors.size % PANEL_BADGE_COLORS.length]);
    }
  }
  return colors;
}

/** Dashboard-level warning listing Text panel images held back until their source is approved. */
export function BlockedImagesAlert() {
  const { reports, allowedHosts } = useImageGuardState();
  const resources = useMemo(() => groupByHost(reports), [reports]);
  const [isReviewing, setIsReviewing] = useState(false);
  const styles = useStyles2(getStyles);

  const resetButton = allowedHosts.size > 0 && (
    <Button
      className={styles.reset}
      variant="secondary"
      size="sm"
      icon="history"
      onClick={() => {
        setIsReviewing(false);
        resetAllowedHosts();
      }}
    >
      {t('text-image-guard.reset', 'Reset session data')}
    </Button>
  );

  if (resources.length === 0) {
    return resetButton || null;
  }

  const imageCount = resources.reduce((sum, r) => sum + r.imageCount, 0);

  return (
    <>
      {resetButton}
      <Alert
        className={styles.alert}
        severity="warning"
        bottomSpacing={0}
        title={t(
          'text-image-guard.alert.title',
          '{{resourceCount}} resources with {{imageCount}} images are being blocked',
          { resourceCount: resources.length, imageCount }
        )}
        action={
          <Button variant="secondary" size="sm" fill="outline" onClick={() => setIsReviewing(true)}>
            {t('text-image-guard.alert.review', 'Review')}
          </Button>
        }
      >
        {t('text-image-guard.alert.body', 'To see these images, please review and allow their sources')}
      </Alert>
      {isReviewing && <ReviewModal resources={resources} onDismiss={() => setIsReviewing(false)} />}
    </>
  );
}

function ReviewModal({ resources, onDismiss }: { resources: BlockedResource[]; onDismiss: () => void }) {
  const styles = useStyles2(getStyles);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const panelColors = useMemo(() => getPanelColors(resources), [resources]);

  const toggle = (host: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(host) ? next.delete(host) : next.add(host);
      return next;
    });

  const onAllow = (scope: AllowScope) => {
    const count = selected.size;
    allowHosts(Array.from(selected), scope);
    onDismiss();

    const message =
      scope === 'always'
        ? t('text-image-guard.toast.always-allowed', '', {
            count,
            defaultValue_one: '{{count}} source has now been indefinitely allowed',
            defaultValue_other: '{{count}} sources have now been indefinitely allowed',
          })
        : t('text-image-guard.toast.allowed', '', {
            count,
            defaultValue_one: '{{count}} source has now been allowed for this session',
            defaultValue_other: '{{count}} sources have now been allowed for this session',
          });
    appEvents.emit(AppEvents.alertSuccess, [message]);
  };

  const nothingSelected = selected.size === 0;
  const allSelected = resources.every((r) => selected.has(r.host));

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(resources.map((r) => r.host)));

  return (
    <Modal
      isOpen
      title={t('text-image-guard.modal.title', 'Blocked resources')}
      onDismiss={onDismiss}
      className={styles.modal}
    >
      <div className={styles.selectAll}>
        <Checkbox
          label={t('text-image-guard.modal.select-all', 'Select all')}
          value={allSelected}
          indeterminate={!nothingSelected && !allSelected}
          onChange={toggleAll}
        />
      </div>
      <ul className={styles.list}>
        {resources.map((resource) => (
          <ResourceRow
            key={resource.host}
            resource={resource}
            panelColors={panelColors}
            checked={selected.has(resource.host)}
            onToggle={() => toggle(resource.host)}
          />
        ))}
      </ul>
      <Modal.ButtonRow>
        <Tooltip
          content={t(
            'text-image-guard.modal.allow-tooltip',
            'Load images from the selected sources until you end this session.'
          )}
        >
          <Button
            variant="secondary"
            icon="question-circle"
            iconPlacement="right"
            disabled={nothingSelected}
            onClick={() => onAllow('session')}
          >
            {t('text-image-guard.modal.allow', 'Allow')}
          </Button>
        </Tooltip>
        <Tooltip
          content={t(
            'text-image-guard.modal.always-allow-tooltip',
            'Always load images from the selected sources, on any dashboard. Saved for this session only in this prototype.'
          )}
        >
          <Button
            variant="primary"
            icon="question-circle"
            iconPlacement="right"
            disabled={nothingSelected}
            onClick={() => onAllow('always')}
          >
            {t('text-image-guard.modal.always-allow', 'Always allow')}
          </Button>
        </Tooltip>
      </Modal.ButtonRow>
    </Modal>
  );
}

interface ResourceRowProps {
  resource: BlockedResource;
  panelColors: Map<string, BadgeColor>;
  checked: boolean;
  onToggle: () => void;
}

function ResourceRow({ resource, panelColors, checked, onToggle }: ResourceRowProps) {
  const styles = useStyles2(getStyles);
  const hiddenCount = resource.urls.length - VISIBLE_URLS;
  const checkboxId = `blocked-resource-${resource.host}`;

  return (
    <li className={styles.row}>
      <Checkbox id={checkboxId} value={checked} onChange={onToggle} className={styles.checkbox} />
      <div className={styles.rowBody}>
        <Stack alignItems="center" gap={1} wrap="wrap">
          <label htmlFor={checkboxId} className={styles.host}>
            {resource.host}
          </label>
          {resource.panelTitles.map((panelTitle) => (
            <Badge
              key={panelTitle}
              color={panelColors.get(panelTitle) ?? PANEL_BADGE_COLORS[0]}
              text={panelTitle || t('text-image-guard.modal.untitled-panel', 'Untitled panel')}
            />
          ))}
        </Stack>
        {resource.urls.slice(0, VISIBLE_URLS).map((image) => (
          <div key={image.url} className={styles.url} title={image.url}>
            {image.segments.map((segment, i) =>
              segment.fromData ? (
                <mark key={i} className={styles.dataSegment}>
                  {segment.text}
                </mark>
              ) : (
                <span key={i}>{segment.text}</span>
              )
            )}
          </div>
        ))}
        {hiddenCount > 0 && (
          <div className={styles.more}>
            {t('text-image-guard.modal.more', '+ {{hiddenCount}} more', { hiddenCount })}
          </div>
        )}
      </div>
      <span
        className={styles.count}
        aria-label={t('text-image-guard.modal.image-count', '{{imageCount}} images', {
          imageCount: resource.imageCount,
        })}
      >
        {resource.imageCount}
      </span>
    </li>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // Alert's wrapper sets flexGrow: 1, which stretches it to fill the dashboard's flex column.
  alert: css({
    flex: 'none',
    marginBottom: theme.spacing(1),
  }),
  // Prototype-only control, kept out of the dashboard layout.
  reset: css({
    position: 'fixed',
    right: theme.spacing(2),
    bottom: theme.spacing(2),
    zIndex: theme.zIndex.portal,
    boxShadow: theme.shadows.z3,
  }),
  modal: css({
    width: '640px',
  }),
  selectAll: css({
    paddingBottom: theme.spacing(1.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  row: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1.5, 0),
    '& + &': {
      borderTop: `1px solid ${theme.colors.border.weak}`,
    },
  }),
  checkbox: css({
    marginTop: theme.spacing(0.25),
  }),
  rowBody: css({
    flex: 1,
    minWidth: 0,
  }),
  host: css({
    margin: 0,
    fontWeight: theme.typography.fontWeightBold,
    cursor: 'pointer',
  }),
  url: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: theme.spacing(0.5),
  }),
  dataSegment: css({
    background: theme.colors.warning.transparent,
    color: theme.colors.warning.text,
    borderRadius: theme.shape.radius.sm,
    padding: theme.spacing(0, 0.25),
  }),
  more: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginTop: theme.spacing(0.5),
  }),
  count: css({
    color: theme.colors.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  }),
});
