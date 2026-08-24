import { css } from '@emotion/css';
import { useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import { Alert, EmptyState, RadioButtonGroup, Sidebar, Stack, useStyles2 } from '@grafana/ui';
import { MonacoDiffEditor } from 'app/core/components/MonacoDiffEditor/MonacoDiffEditor';
import { InlineDiffToggle, useInlineDiffPreference } from 'app/core/components/MonacoDiffEditor/inlineDiffPreference';

import { getDashboardSceneFor } from '../utils/utils';
import { type SchemaEditorFormat } from '../v2schema/DashboardSchemaEditor';

import { getDashboardDiffTexts, getDashboardResourceText } from './codePaneUtils';

export class DashboardDiffPane extends SceneObjectBase {
  public static Component = DashboardDiffPaneRenderer;
  public minWidth = 700;

  public getId() {
    return 'diff' as const;
  }
}

function DashboardDiffPaneRenderer({ model }: SceneComponentProps<DashboardDiffPane>) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);

  const [format, setFormat] = useState<SchemaEditorFormat>('json');
  const [inlineDiff, setInlineDiff] = useInlineDiffPreference();

  // Serialize the scene once, on mount. A new pane instance is constructed on every open, so this
  // always reflects the current dashboard - no scene graph subscription needed to stay fresh.
  const [currentJsonText] = useState(() => getDashboardResourceText(dashboard, 'json'));

  const diffTexts = useMemo(
    () => getDashboardDiffTexts(dashboard, currentJsonText, format),
    [dashboard, currentJsonText, format]
  );

  const formatOptions: Array<{ label: string; value: SchemaEditorFormat }> = [
    { label: t('dashboard.sidebar.diff.format-json', 'JSON'), value: 'json' },
    { label: t('dashboard.sidebar.diff.format-yaml', 'YAML'), value: 'yaml' },
  ];

  const hasDiff = diffTexts !== null && diffTexts.original !== diffTexts.current;

  let content: React.ReactNode;
  if (!diffTexts) {
    // No comparable original: the dashboard has no initial save model, or it was loaded as v1 and
    // the v1->v2 conversion of the original failed.
    content = (
      <Alert
        severity="info"
        title={t('dashboard.sidebar.diff.unavailable', 'Cannot show changes')}
        topSpacing={0}
        bottomSpacing={0}
      >
        {t('dashboard.sidebar.diff.unavailable-body', 'The last saved dashboard is not available for comparison.')}
      </Alert>
    );
  } else if (!hasDiff) {
    content = (
      <EmptyState variant="completed" message={t('dashboard.sidebar.diff.no-changes', 'No changes to show')}>
        {t('dashboard.sidebar.diff.no-changes-body', 'The dashboard matches the last saved version.')}
      </EmptyState>
    );
  } else {
    content = (
      <>
        {diffTexts.migratedFromV1 && (
          <Alert
            severity="info"
            topSpacing={0}
            bottomSpacing={0}
            title={t(
              'dashboard.sidebar.diff.migrated',
              'Note: The diff also includes changes resulting from migration to the new dashboard format.'
            )}
          />
        )}
        <div className={styles.diffContainer}>
          <MonacoDiffEditor
            original={diffTexts.original}
            modified={diffTexts.current}
            language={format}
            height="100%"
            inline={inlineDiff}
          />
        </div>
      </>
    );
  }

  return (
    <div className={styles.wrapper}>
      <Sidebar.PaneHeader title={t('dashboard.sidebar.diff.pane-header', 'Changes')} />
      <div className={styles.content}>
        {hasDiff && (
          <div className={styles.toolbar}>
            <Stack direction="row" gap={1} alignItems="center">
              <RadioButtonGroup options={formatOptions} value={format} onChange={setFormat} />
              <InlineDiffToggle value={inlineDiff} onChange={setInlineDiff} />
            </Stack>
          </div>
        )}
        {content}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: '1 1 0',
    height: '100%',
  }),
  content: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    padding: theme.spacing(1),
    gap: theme.spacing(1),
  }),
  toolbar: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: '0 0 auto',
  }),
  diffContainer: css({
    height: '100%',
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'auto',
  }),
});
