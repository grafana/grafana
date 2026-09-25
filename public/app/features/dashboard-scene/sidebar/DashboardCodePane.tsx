import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import {
  Alert,
  Button,
  ClipboardButton,
  EmptyState,
  IconButton,
  InlineSwitch,
  Modal,
  Sidebar,
  Stack,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { MonacoDiffEditor } from 'app/core/components/MonacoDiffEditor/MonacoDiffEditor';
import { InlineDiffToggle, useInlineDiffPreference } from 'app/core/components/MonacoDiffEditor/inlineDiffPreference';

import { getDashboardSceneFor } from '../utils/utils';
import { DashboardSchemaEditor, type SchemaEditorFormat } from '../v2schema/DashboardSchemaEditor';

import { applyJsonToDashboard, getDashboardDiffTexts, getDashboardResourceText } from './codePaneUtils';

export class DashboardCodePane extends SceneObjectBase {
  public static Component = DashboardCodePaneRenderer;
  public minWidth = 700;

  public getId() {
    return 'code' as const;
  }
}

function DashboardCodePaneRenderer({ model }: SceneComponentProps<DashboardCodePane>) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);

  const [hasValidationErrors, setHasValidationErrors] = useState(true);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState(() => getDashboardResourceText(dashboard, 'json'));
  const [isExpanded, setIsExpanded] = useState(false);
  const [editorFormat, setEditorFormat] = useState<SchemaEditorFormat>('json');
  const [showDiff, setShowDiff] = useState(false);
  const [inlineDiff, setInlineDiff] = useInlineDiffPreference();
  const [hasSyntaxError, setHasSyntaxError] = useState(false);

  const isJsonParseable = useMemo(() => {
    try {
      JSON.parse(jsonText);
      return true;
    } catch {
      return false;
    }
  }, [jsonText]);

  // In YAML mode a parse error means jsonText no longer reflects the buffer on screen, so a diff
  // built from it would compare stale content.
  const canShowDiff = isJsonParseable && !hasSyntaxError;

  const diffTexts = useMemo(
    () => (showDiff ? getDashboardDiffTexts(dashboard, jsonText, editorFormat) : null),
    [showDiff, dashboard, jsonText, editorFormat]
  );

  const handleChange = useCallback((value: string) => {
    setJsonText(value);
    setApplyError(null);
  }, []);

  const handleApply = useCallback(() => {
    setApplyError(null);

    const result = applyJsonToDashboard(dashboard, jsonText);
    if (!result.success) {
      setApplyError(result.error ?? 'Failed to apply changes');
    }
  }, [dashboard, jsonText]);

  const getResourceText = useCallback(
    () => getDashboardResourceText(dashboard, editorFormat),
    [dashboard, editorFormat]
  );

  const copyAsResourceButton = (
    <ClipboardButton
      variant="secondary"
      size="sm"
      icon="copy"
      getText={getResourceText}
      tooltip={t(
        'dashboard.sidebar.edit-schema.copy-as-resource-tooltip',
        'Copy dashboard as resource (with apiVersion, kind and metadata) for use in provisioning files'
      )}
    >
      {t('dashboard.sidebar.edit-schema.copy-as-resource', 'Copy as resource')}
    </ClipboardButton>
  );

  const diffToggle = (
    <Tooltip
      content={t('dashboard.sidebar.edit-schema.diff-disabled-tooltip', 'Fix syntax errors to view the diff')}
      placement="top"
      show={canShowDiff ? false : undefined}
    >
      <div>
        <InlineSwitch
          label={t('dashboard.sidebar.edit-schema.diff-toggle', 'Show diff')}
          showLabel
          value={showDiff}
          disabled={!canShowDiff}
          onChange={(e) => setShowDiff(e.currentTarget.checked)}
        />
      </div>
    </Tooltip>
  );

  const applyTooltip =
    editorFormat === 'yaml'
      ? t(
          'dashboard.sidebar.edit-schema.apply-button-disabled-tooltip-yaml',
          'Document has validation errors. Switch to JSON to see inline error details.'
        )
      : t(
          'dashboard.sidebar.edit-schema.apply-button-disabled-tooltip',
          'Fix validation errors before applying changes'
        );

  const applyButton = (
    <Tooltip content={applyTooltip} placement="top" show={hasValidationErrors ? undefined : false}>
      <Button onClick={handleApply} disabled={hasValidationErrors} size="sm">
        {t('dashboard.sidebar.edit-schema.apply-button', 'Apply changes')}
      </Button>
    </Tooltip>
  );

  const errorAlert = applyError ? (
    <Alert
      title={t('dashboard.sidebar.edit-schema.apply-error-title', 'Failed to apply changes')}
      severity="error"
      topSpacing={0}
      bottomSpacing={0}
      className={styles.errorAlert}
    >
      {applyError}
    </Alert>
  ) : null;

  const editorProps = {
    value: jsonText,
    onChange: handleChange,
    onValidationChange: setHasValidationErrors,
    onParseErrorChange: setHasSyntaxError,
    onFormatChange: setEditorFormat,
    showFormatToggle: true,
    headerLeftActions: (
      <>
        {diffToggle}
        {showDiff && <InlineDiffToggle value={inlineDiff} onChange={setInlineDiff} />}
      </>
    ),
  };

  // Null diff texts means there is no comparable original: the dashboard has no initial save
  // model, or it was loaded as v1 and the v1->v2 conversion of the original failed.
  const diffView = !diffTexts ? (
    <Alert
      severity="info"
      title={t('dashboard.sidebar.edit-schema.diff-unavailable', 'Cannot show changes')}
      topSpacing={0}
      bottomSpacing={0}
    >
      {t(
        'dashboard.sidebar.edit-schema.diff-unavailable-body',
        'The original dashboard is not available for comparison.'
      )}
    </Alert>
  ) : diffTexts.original === diffTexts.current ? (
    <EmptyState variant="completed" message={t('dashboard.sidebar.edit-schema.diff-no-changes', 'No changes to show')}>
      {t(
        'dashboard.sidebar.edit-schema.diff-no-changes-body',
        'The dashboard matches the original. Changes appear here as you make them.'
      )}
    </EmptyState>
  ) : (
    <>
      {diffTexts.migratedFromV1 && (
        <Alert
          severity="info"
          topSpacing={0}
          bottomSpacing={0}
          title={t(
            'dashboard.sidebar.edit-schema.diff-migrated',
            'Note: The diff also includes changes resulting from migration to the new dashboard format.'
          )}
        />
      )}
      <div className={styles.diffContainer}>
        <MonacoDiffEditor
          original={diffTexts.original}
          modified={diffTexts.current}
          language={editorFormat}
          height="100%"
          inline={inlineDiff}
        />
      </div>
    </>
  );

  const editorArea = (containerStyles?: string) => (
    <DashboardSchemaEditor
      {...editorProps}
      containerStyles={containerStyles}
      contentOverride={showDiff ? diffView : undefined}
    />
  );

  return (
    <div className={styles.wrapper}>
      <Sidebar.PaneHeader title={t('dashboard.sidebar.edit-schema.pane-header', 'Edit as code')} />
      <div className={styles.content}>
        {errorAlert}
        {/* Render only one editor instance at a time: the expanded modal covers the pane, and two
            live instances would race on the shared parse-error flag. */}
        <div className={styles.editorContainer}>{!isExpanded && editorArea(styles.codeEditor)}</div>
        <div className={styles.toolbar}>
          <Stack gap={1} alignItems="center">
            {applyButton}
            {copyAsResourceButton}
          </Stack>
          <IconButton
            name="expand-arrows"
            size="sm"
            tooltip={t('dashboard.sidebar.edit-schema.expand', 'Expand editor')}
            onClick={() => setIsExpanded(true)}
          />
        </div>
      </div>

      {isExpanded && (
        <Modal
          title={t('dashboard.sidebar.edit-schema.modal-title', 'Edit dashboard as code')}
          isOpen
          onDismiss={() => setIsExpanded(false)}
          className={styles.modal}
          contentClassName={styles.modalContent}
          closeOnBackdropClick={false}
          closeOnEscape={false}
        >
          <div className={styles.modalEditorWrapper}>
            {errorAlert}
            {editorArea()}
            <div className={styles.toolbar}>
              <Stack gap={1} alignItems="center">
                {applyButton}
                {copyAsResourceButton}
              </Stack>
              <IconButton
                name="compress-arrows"
                size="sm"
                tooltip={t('dashboard.sidebar.edit-schema.collapse', 'Collapse editor')}
                onClick={() => setIsExpanded(false)}
              />
            </div>
          </div>
        </Modal>
      )}
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
  errorAlert: css({
    flex: '0 0 auto',
  }),
  editorContainer: css({
    flex: 1,
    minHeight: 0,
  }),
  codeEditor: css({
    height: '100%',
  }),
  diffContainer: css({
    height: '100%',
    flex: '1 1 0',
    minHeight: 0,
    overflow: 'auto',
  }),
  toolbar: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: '0 0 auto',
  }),
  modal: css({
    width: '90vw',
    height: '90vh',
    maxWidth: '90vw',
  }),
  modalContent: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
  }),
  modalEditorWrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0,
    gap: theme.spacing(1),
  }),
});
