import { css } from '@emotion/css';
import { useEffect, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Alert, Button, Icon, Modal, Sidebar, Spinner, Stack, useStyles2 } from '@grafana/ui';

import { type DashboardEditIntegrityTracker } from '../DashboardEditIntegrityTracker';

export function IntegrityCheckButton({ tracker }: { tracker: DashboardEditIntegrityTracker }) {
  const { records, failure } = tracker.useState();
  const [open, setOpen] = useState(false);
  const styles = useStyles2(getStyles);
  const warning = records.length > 0 || Boolean(failure);
  const title = warning
    ? t('dashboard.integrity.button-warning', 'Undo/redo diagnostics: findings need review')
    : t('dashboard.integrity.button', 'Check undo/redo integrity');

  return (
    <>
      <div className={styles.button}>
        <Sidebar.Button
          icon="bug"
          title={t('dashboard.integrity.label', 'Integrity')}
          tooltip={title}
          aria-label={title}
          onClick={() => setOpen(true)}
        />
        {warning && <Icon name="exclamation-triangle" size="xs" className={styles.warning} aria-hidden="true" />}
      </div>
      {open && <IntegrityCheckModal tracker={tracker} onDismiss={() => setOpen(false)} />}
    </>
  );
}

export function IntegrityCheckModal({
  tracker,
  onDismiss,
}: {
  tracker: DashboardEditIntegrityTracker;
  onDismiss: () => void;
}) {
  const { records, droppedRecords, failure } = tracker.useState();
  const [checking, setChecking] = useState(true);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (!checking) {
      return;
    }
    // Let the modal paint its progress state before synchronous scene serialization.
    let timer: ReturnType<typeof setTimeout>;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => {
        tracker.check();
        setChecking(false);
      }, 0);
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [checking, tracker]);

  return (
    <Modal title={t('dashboard.integrity.title', 'Undo/redo integrity')} isOpen onDismiss={onDismiss}>
      <p>
        {t(
          'dashboard.integrity.explanation',
          'Detects saved dashboard changes outside recorded actions. Times indicate detection, not when the edit happened. This does not verify that undo restores the correct state.'
        )}
      </p>
      {checking && (
        <div role="status">
          <Spinner /> {t('dashboard.integrity.checking', 'Checking…')}
        </div>
      )}
      {failure && (
        <Alert severity="warning" title={t('dashboard.integrity.failed', 'Could not capture a dashboard snapshot')}>
          {t(
            'dashboard.integrity.failed-body',
            'The next successful check will establish a new baseline. Editing is unaffected.'
          )}
        </Alert>
      )}
      {!checking && !failure && records.length === 0 && (
        <p role="status">{t('dashboard.integrity.clean', 'No untracked changes detected.')}</p>
      )}
      <div className={styles.records}>
        {[...records].reverse().map((record) => (
          <details key={record.id} className={styles.record}>
            <summary className={styles.summary}>
              <Icon name="angle-right" className={styles.chevron} aria-hidden="true" />
              <span className={styles.heading}>
                <span className={styles.recordTitle}>
                  {record.kind === 'untracked'
                    ? t('dashboard.integrity.untracked', 'Untracked changes')
                    : record.kind === 'delayed'
                      ? t('dashboard.integrity.delayed', 'Potentially delayed action')
                      : t('dashboard.integrity.committed', 'Unable to verify committed change')}
                </span>
                <time className={styles.timestamp} dateTime={new Date(record.timestamp).toISOString()}>
                  {new Date(record.timestamp).toLocaleString()}
                </time>
              </span>
              <span className={styles.pathCount}>
                {record.changes.length + record.omittedPaths} {t('dashboard.integrity.paths', 'paths')}
              </span>
            </summary>
            <div className={styles.recordBody}>
              <p>{t('dashboard.integrity.trigger', 'Detected at: {{trigger}}', { trigger: record.trigger })}</p>
              {record.kind === 'delayed' && (
                <Alert severity="info" title={t('dashboard.integrity.delayed-review', 'Manual verification needed')}>
                  {t(
                    'dashboard.integrity.delayed-explanation',
                    'The saved model differed before this action, but the action itself left it unchanged. It may be recording an earlier live edit, such as a panel title committed on blur. An unrelated no-op can look the same; verify that undo restores these paths.'
                  )}
                </Alert>
              )}
              {record.kind === 'committed' && (
                <p>
                  {t(
                    'dashboard.integrity.commit-explanation',
                    'This action was registered after changing the scene. These paths may include both its intended changes and earlier untracked edits.'
                  )}
                </p>
              )}
              <ul className={styles.paths}>
                {record.changes.map((change, index) => (
                  <li key={index}>
                    <code>
                      {change.op} {change.path || '/'}
                    </code>
                  </li>
                ))}
              </ul>
              {record.omittedPaths > 0 && (
                <p>
                  {t('dashboard.integrity.omitted', '', {
                    count: record.omittedPaths,
                    defaultValue_one: '{{count}} additional path omitted.',
                    defaultValue_other: '{{count}} additional paths omitted.',
                  })}
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
      {droppedRecords > 0 && (
        <p>
          {t('dashboard.integrity.dropped', '', {
            count: droppedRecords,
            defaultValue_one: '{{count}} older finding discarded.',
            defaultValue_other: '{{count}} older findings discarded.',
          })}
        </p>
      )}
      <Modal.ButtonRow>
        <Stack gap={1}>
          <Button variant="secondary" disabled={checking} onClick={() => tracker.clearHistory()}>
            {t('dashboard.integrity.clear', 'Clear history')}
          </Button>
          <Button disabled={checking} onClick={() => setChecking(true)}>
            {t('dashboard.integrity.check-again', 'Check again')}
          </Button>
        </Stack>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  button: css({ position: 'relative', width: '100%' }),
  warning: css({
    position: 'absolute',
    top: 0,
    right: 'calc(50% - 18px)',
    color: theme.colors.warning.text,
    pointerEvents: 'none',
  }),
  records: css({
    maxHeight: '50vh',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5),
  }),
  record: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    '&[open] > summary': { borderBottom: `1px solid ${theme.colors.border.weak}` },
    '&[open] > summary > svg': { transform: 'rotate(90deg)' },
  }),
  summary: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5),
    cursor: 'pointer',
    listStyle: 'none',
    borderRadius: theme.shape.radius.default,
    '&::-webkit-details-marker': { display: 'none' },
    '&:hover': { background: theme.colors.action.hover },
    '&:focus-visible': { outline: `2px solid ${theme.colors.primary.border}`, outlineOffset: 2 },
  }),
  chevron: css({ flexShrink: 0, color: theme.colors.text.secondary }),
  heading: css({ display: 'flex', flexDirection: 'column', gap: theme.spacing(0.5), flex: 1, minWidth: 0 }),
  recordTitle: css({ fontWeight: theme.typography.fontWeightMedium, overflowWrap: 'anywhere' }),
  timestamp: css({ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }),
  pathCount: css({
    flexShrink: 0,
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    whiteSpace: 'nowrap',
  }),
  recordBody: css({ padding: theme.spacing(1.5) }),
  paths: css({
    maxHeight: '25vh',
    overflow: 'auto',
    overflowWrap: 'anywhere',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    li: { padding: theme.spacing(0.75, 1), borderBottom: `1px solid ${theme.colors.border.weak}` },
    'li:nth-of-type(odd)': { background: theme.colors.background.primary },
    'li:last-child': { borderBottom: 'none' },
  }),
});
