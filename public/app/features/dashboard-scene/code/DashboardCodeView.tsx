import { css, cx } from '@emotion/css';
import yaml from 'js-yaml';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { SceneObjectStateChangedEvent } from '@grafana/scenes';
import { Alert, Button, Stack, useStyles2 } from '@grafana/ui';
import { MonacoDiffEditor } from 'app/core/components/MonacoDiffEditor/MonacoDiffEditor';
import { useInlineDiffPreference } from 'app/core/components/MonacoDiffEditor/inlineDiffPreference';

import { useSnappingSplitter } from '../panel-edit/splitter/useSnappingSplitter';
import { DashboardSceneChangeTracker } from '../saving/DashboardSceneChangeTracker';
import { type DashboardScene } from '../scene/DashboardScene';
import { getDashboardDiffTexts } from '../sidebar/codePaneUtils';
import { DashboardCodeDiffControls } from '../v2schema/DashboardCodeDiffControls';
import { DashboardSchemaEditor, type SchemaEditorFormat } from '../v2schema/DashboardSchemaEditor';

import { DashboardCodeSaveButton } from './DashboardCodeSaveButton';

export default function DashboardCodeView({ dashboard, children }: { dashboard: DashboardScene; children: ReactNode }) {
  const styles = useStyles2(getStyles);
  const { codeSession } = dashboard.useState();
  const { containerProps, primaryProps, secondaryProps, splitterProps, splitterState, onToggleCollapse } =
    useSnappingSplitter({
      direction: 'column',
      dragPosition: 'middle',
      initialSize: 0.5,
      collapseBelowPixels: 150,
    });

  return (
    <div {...containerProps} className={cx(containerProps.className, styles.split)}>
      <div {...primaryProps} style={{ ...primaryProps.style, minHeight: 0, overflow: 'hidden' }}>
        {children}
      </div>
      <div
        {...splitterProps}
        aria-label={t('dashboard.modes.code.resize', 'Resize dashboard and code editor')}
        aria-orientation="horizontal"
      />
      <div {...secondaryProps}>
        {splitterState.collapsed && (
          <div className={styles.expandPane}>
            <Button
              aria-label={t('dashboard.modes.code.open-pane', 'Open code pane')}
              tooltip={t('dashboard.modes.code.open-pane', 'Open code pane')}
              icon="angle-up"
              variant="secondary"
              size="sm"
              onClick={onToggleCollapse}
            />
          </div>
        )}
        {codeSession && (
          <div className={styles.codePane} style={{ display: splitterState.collapsed ? 'none' : 'flex' }}>
            <CodeEditor dashboard={dashboard} session={codeSession} />
          </div>
        )}
      </div>
    </div>
  );
}

function CodeEditor({
  dashboard,
  session,
}: {
  dashboard: DashboardScene;
  session: NonNullable<DashboardScene['state']['codeSession']>;
}) {
  const styles = useStyles2(getStyles);
  const { text, baseline, error, incoming, conflicts, resolutions, hasParseError } = session.useState();
  const [inlineDiff, setInlineDiff] = useInlineDiffPreference();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [editorFormat, setEditorFormat] = useState<SchemaEditorFormat>('json');
  const [hasEditorErrors, setHasEditorErrors] = useState(false);
  const onParseErrorChange = useCallback(
    (hasErrors: boolean) => {
      session.setParseError(hasErrors);
      dashboard.forceRender();
    },
    [dashboard, session]
  );
  const validationError = useMemo(() => session.getValidationError(dashboard, text), [session, dashboard, text]);
  // The merge baseline tracks the live scene; the diff tracks the last saved dashboard.
  const diff =
    getDashboardDiffTexts(dashboard, text, editorFormat) ?? getDashboardDiffTexts(dashboard, baseline, editorFormat);
  const original = diff?.original ?? formatCodeForDiff(baseline, editorFormat);
  const modified = validationError
    ? formatCodeForDiff(text, editorFormat)
    : (diff?.current ?? formatCodeForDiff(text, editorFormat));
  useEffect(() => {
    let active = true;
    let queued = false;
    const sync = () => {
      if (!queued) {
        queued = true;
        // Scene mutations may update several persisted fields in one synchronous action.
        queueMicrotask(() => {
          queued = false;
          if (active) {
            const previousState = session.state;
            session.sync(dashboard);
            if (session.state !== previousState) {
              dashboard.forceRender();
            }
          }
        });
      }
    };
    sync();
    const subscription = dashboard.subscribeToEvent(SceneObjectStateChangedEvent, (event) => {
      if (DashboardSceneChangeTracker.isUpdatingPersistedState(event)) {
        sync();
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [dashboard, session]);

  return (
    <div
      className={styles.container}
      role="region"
      aria-label={t('dashboard.modes.code-editor', 'Dashboard code editor')}
    >
      <DashboardSchemaEditor
        showFormatToggle
        onFormatChange={setEditorFormat}
        onParseErrorChange={onParseErrorChange}
        renderHeader={(formatToggle) => (
          <>
            <div
              className={styles.actions}
              role="group"
              aria-label={t('dashboard.modes.code.actions', 'Dashboard code actions')}
            >
              <div className={styles.viewActions}>
                {formatToggle}
                <DashboardCodeDiffControls
                  showDiff={showDiff && !reviewOpen}
                  canShowDiff={!hasParseError}
                  onShowDiffChange={(value) => {
                    setShowDiff(value);
                    setReviewOpen(false);
                  }}
                  inlineDiff={inlineDiff}
                  onInlineDiffChange={setInlineDiff}
                  original={original}
                  modified={modified}
                />
                {conflicts.length > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-pressed={reviewOpen}
                    onClick={() => {
                      setReviewOpen(!reviewOpen);
                      setShowDiff(false);
                    }}
                  >
                    {t('dashboard.modes.code.review', 'Review changes')}
                  </Button>
                )}
              </div>
              <div className={styles.applyActions}>
                {reviewOpen && conflicts.length > 0 && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={conflicts.some(({ path }) => !resolutions[path])}
                    onClick={() => {
                      if (session.finishReview(dashboard)) {
                        dashboard.forceRender();
                        setReviewOpen(false);
                      }
                    }}
                  >
                    {t('dashboard.modes.code.finish-review', 'Use resolved code')}
                  </Button>
                )}
                <DashboardCodeSaveButton
                  dashboard={dashboard}
                  hasChanges={session.hasChanges()}
                  invalid={
                    conflicts.length > 0 || Boolean(validationError) || hasEditorErrors || Boolean(hasParseError)
                  }
                  onApply={() => {
                    const applied = session.apply(dashboard);
                    dashboard.forceRender();
                    return applied;
                  }}
                />
              </div>
            </div>
            {error && !validationError && (
              <Alert
                className={styles.error}
                severity="error"
                title={t('dashboard.modes.code.error', 'Code changes could not be applied')}
              >
                {error}
              </Alert>
            )}
            {incoming && (
              <div role="status" className={styles.status}>
                {conflicts.length
                  ? t(
                      'dashboard.modes.code.review-needed',
                      'Dashboard updated. Review overlapping changes before applying.'
                    )
                  : t(
                      'dashboard.modes.code.update-pending',
                      'Dashboard updated. Your text is safe. Fix the code to merge and review changes.'
                    )}
              </div>
            )}
            {showDiff && diff?.migratedFromV1 && (
              <div role="status" className={styles.status}>
                {t(
                  'dashboard.modes.code.migrated-diff',
                  'This dashboard was converted to the new schema. The diff may include migration changes.'
                )}
              </div>
            )}
          </>
        )}
        value={text}
        onValidationChange={setHasEditorErrors}
        onChange={(value) => {
          session.updateText(value);
          dashboard.forceRender();
        }}
        containerStyles={styles.schemaEditor}
        contentStyles={styles.editor}
        contentOverride={
          reviewOpen && conflicts.length > 0 ? (
            <ConflictReview session={session} />
          ) : showDiff ? (
            <div
              className={styles.diff}
              role="region"
              aria-label={t('dashboard.modes.code.diff', 'Unsaved dashboard changes')}
            >
              <MonacoDiffEditor
                original={original}
                modified={modified}
                inline={inlineDiff}
                language={editorFormat}
                height="100%"
              />
            </div>
          ) : undefined
        }
      />
    </div>
  );
}

function ConflictReview({ session }: { session: NonNullable<DashboardScene['state']['codeSession']> }) {
  const styles = useStyles2(getStyles);
  const { conflicts, resolutions } = session.useState();
  return (
    <div
      className={styles.review}
      role="region"
      aria-label={t('dashboard.modes.code.review-title', 'Code conflict review')}
    >
      <p>
        {t(
          'dashboard.modes.code.review-help',
          'Choose a version for each conflict. Other changes merge automatically. You can edit the resolved code before applying it.'
        )}
      </p>
      {conflicts.map((conflict) => (
        <section key={conflict.path} className={styles.conflict} aria-label={conflict.path || '/'}>
          <h5>{conflict.path || '/'}</h5>
          <div className={styles.versions}>
            {[
              { label: t('dashboard.modes.code.base', 'Starting version'), value: conflict.base },
              { label: t('dashboard.modes.code.mine', 'Your edits'), value: conflict.local },
              { label: t('dashboard.modes.code.latest', 'Current dashboard'), value: conflict.incoming },
            ].map(({ label, value }) => (
              <div key={label} className={styles.version}>
                <strong>{label}</strong>
                <pre>
                  {value === undefined
                    ? t('dashboard.modes.code.deleted', '(not present)')
                    : JSON.stringify(value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
          <Stack>
            <Button
              size="sm"
              variant="secondary"
              aria-label={t('dashboard.modes.code.keep-mine-label', 'Keep mine for {{- path}}', {
                path: conflict.path || '/',
              })}
              aria-pressed={resolutions[conflict.path] === 'local'}
              icon={resolutions[conflict.path] === 'local' ? 'check' : undefined}
              onClick={() => session.chooseResolution(conflict.path, 'local')}
            >
              {t('dashboard.modes.code.keep-mine', 'Keep mine')}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              aria-label={t('dashboard.modes.code.use-dashboard-label', 'Use dashboard version for {{- path}}', {
                path: conflict.path || '/',
              })}
              aria-pressed={resolutions[conflict.path] === 'incoming'}
              icon={resolutions[conflict.path] === 'incoming' ? 'check' : undefined}
              onClick={() => session.chooseResolution(conflict.path, 'incoming')}
            >
              {t('dashboard.modes.code.use-dashboard', 'Use dashboard version')}
            </Button>
          </Stack>
        </section>
      ))}
    </div>
  );
}

function formatCodeForDiff(text: string, format: SchemaEditorFormat) {
  try {
    const resource = JSON.parse(text);
    return format === 'yaml'
      ? yaml.dump(resource, { indent: 2, lineWidth: -1, noRefs: true })
      : JSON.stringify(resource, null, 2);
  } catch {
    return text;
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  actions: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    padding: theme.spacing(1, 2),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
    flexWrap: 'wrap',
    flexShrink: 0,
  }),
  viewActions: css({ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(1) }),
  applyActions: css({ display: 'flex', alignItems: 'center', gap: theme.spacing(1), marginLeft: 'auto' }),
  status: css({ padding: theme.spacing(1, 2), flexShrink: 0 }),
  diff: css({ flex: 1, minHeight: 0 }),
  review: css({ overflow: 'auto', minHeight: 0, padding: 8 }),
  conflict: css({ marginBottom: 24 }),
  versions: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 16,
    '@media (max-width: 768px)': { gridTemplateColumns: '1fr' },
  }),
  version: css({
    minWidth: 0,
    pre: { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 180, overflow: 'auto', marginTop: 8 },
  }),
  codePane: css({ flex: 1, minHeight: 0, minWidth: 0 }),
  schemaEditor: css({ flex: 1, minHeight: 0, gap: 0 }),
  split: css({ flex: '1 1 0', minHeight: 0 }),
  expandPane: css({ display: 'flex', flex: 1, justifyContent: 'center', padding: 8 }),
  container: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
    minHeight: 0,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    overflow: 'hidden',
  }),
  error: css({ maxHeight: '40%', overflow: 'auto', flexShrink: 0 }),
  editor: css({ flex: 1, minHeight: 0, padding: theme.spacing(2) }),
});
