import { css, cx } from '@emotion/css';
import { useCallback, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SceneComponentProps, SceneObjectBase } from '@grafana/scenes';
import {
  Alert,
  Button,
  ClipboardButton,
  Icon,
  IconButton,
  InlineToast,
  Modal,
  Sidebar,
  Stack,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';
import { DashboardSchemaEditor, type SchemaEditorFormat } from '../v2schema/DashboardSchemaEditor';

import { applyJsonToDashboard, formatForEditor, getDashboardJsonText, getSharingExportText } from './codePaneUtils';

export class DashboardCodePane extends SceneObjectBase {
  public static Component = DashboardCodePaneRenderer;
  public minWidth = 700;

  public getId() {
    return 'code' as const;
  }
}

export function DashboardCodePaneRenderer({ model }: SceneComponentProps<DashboardCodePane>) {
  const styles = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);

  const [hasValidationErrors, setHasValidationErrors] = useState(true);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState(() => getDashboardJsonText(dashboard));
  const [isExpanded, setIsExpanded] = useState(false);
  const [editorFormat, setEditorFormat] = useState<SchemaEditorFormat>('json');
  const [sharingCopied, setSharingCopied] = useState(false);
  const sharingButtonRef = useRef<HTMLButtonElement>(null);

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

  const handleCopyForSharing = useCallback(async () => {
    setApplyError(null);

    try {
      const text = await getSharingExportText(dashboard, jsonText, editorFormat);
      await navigator.clipboard.writeText(text);
      setSharingCopied(true);
      setTimeout(() => setSharingCopied(false), 2000);
    } catch (error) {
      setApplyError(
        error instanceof Error
          ? error.message
          : t('dashboard.code-pane.copy-for-sharing-error', 'Failed to copy dashboard for sharing')
      );
    }
  }, [dashboard, jsonText, editorFormat]);

  const applyTooltip =
    editorFormat === 'yaml'
      ? t(
          'dashboard.schema-editor.apply-button-disabled-tooltip-yaml',
          'Document has validation errors. Switch to JSON to see inline error details.'
        )
      : t('dashboard.schema-editor.apply-button-disabled-tooltip', 'Fix validation errors before applying changes');

  const applyButton = (
    <Tooltip content={applyTooltip} placement="top" show={hasValidationErrors ? undefined : false}>
      <Button onClick={handleApply} disabled={hasValidationErrors} size="sm">
        {t('dashboard.schema-editor.apply-button', 'Apply changes')}
      </Button>
    </Tooltip>
  );

  const actionButtons = (
    <Stack direction="row" gap={1} alignItems="center">
      {applyButton}
      <ClipboardButton
        icon="copy"
        variant="secondary"
        size="sm"
        disabled={hasValidationErrors}
        getText={() => formatForEditor(jsonText, editorFormat)}
      >
        {t('dashboard.code-pane.copy-to-clipboard', 'Copy to clipboard')}
      </ClipboardButton>
      {sharingCopied && (
        <InlineToast placement="top" referenceElement={sharingButtonRef.current}>
          {t('dashboard.code-pane.copy-for-sharing-copied', 'Copied')}
        </InlineToast>
      )}
      <Button
        ref={sharingButtonRef}
        icon="copy"
        variant={sharingCopied ? 'success' : 'secondary'}
        size="sm"
        disabled={hasValidationErrors}
        onClick={handleCopyForSharing}
        className={cx(styles.copyButton, sharingCopied && styles.copyButtonSuccess)}
      >
        {t('dashboard.code-pane.copy-for-sharing', 'Copy for sharing')}
        {sharingCopied && (
          <div className={styles.copySuccessOverlay}>
            <Icon name="check" />
          </div>
        )}
      </Button>
    </Stack>
  );

  const errorAlert = applyError ? (
    <Alert
      title={t('dashboard.schema-editor.apply-error-title', 'Failed to apply changes')}
      severity="error"
      topSpacing={0}
      bottomSpacing={0}
    >
      {applyError}
    </Alert>
  ) : null;

  const editorProps = {
    value: jsonText,
    onChange: handleChange,
    onValidationChange: setHasValidationErrors,
    onFormatChange: setEditorFormat,
    showFormatToggle: true,
  };

  return (
    <div className={styles.wrapper}>
      <Sidebar.PaneHeader title={t('dashboard.code-pane.header', 'Edit as code')} />
      <div className={styles.content}>
        {errorAlert}
        <div className={styles.editorContainer}>
          <DashboardSchemaEditor {...editorProps} containerStyles={styles.codeEditor} />
        </div>
        <div className={styles.toolbar}>
          {actionButtons}
          <IconButton
            name="expand-arrows"
            size="sm"
            tooltip={t('dashboard.code-pane.expand', 'Expand editor')}
            onClick={() => setIsExpanded(true)}
          />
        </div>
      </div>

      {isExpanded && (
        <Modal
          title={t('dashboard.code-pane.modal-title', 'Edit dashboard as code')}
          isOpen
          onDismiss={() => setIsExpanded(false)}
          className={styles.modal}
          contentClassName={styles.modalContent}
          closeOnBackdropClick={false}
          closeOnEscape={false}
        >
          <div className={styles.modalEditorWrapper}>
            {errorAlert}
            <DashboardSchemaEditor {...editorProps} />
            <div className={styles.toolbar}>
              {actionButtons}
              <IconButton
                name="compress-arrows"
                size="sm"
                tooltip={t('dashboard.code-pane.collapse', 'Collapse editor')}
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
  editorContainer: css({
    flex: 1,
    minHeight: 0,
  }),
  codeEditor: css({
    height: '100%',
  }),
  toolbar: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: '0 0 auto',
  }),
  copyButton: css({
    position: 'relative',
  }),
  copyButtonSuccess: css({
    '> *': {
      visibility: 'hidden',
    },
  }),
  copySuccessOverlay: css({
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    left: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    visibility: 'visible',
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
