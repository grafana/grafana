import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, CodeEditor, Modal, Spinner, Stack, Text, Tooltip, useStyles2 } from '@grafana/ui';

export interface PreviewContentModalProps {
  isOpen: boolean;
  title: string;
  content: string;
  isLoading: boolean;
  language: 'yaml' | 'json';
  onDismiss: () => void;
  reveal?: {
    isRevealed: boolean;
    canReveal: boolean;
    onToggle: () => void;
  };
}

export function PreviewContentModal({
  isOpen,
  title,
  content,
  isLoading,
  language,
  onDismiss,
  reveal,
}: PreviewContentModalProps) {
  const styles = useStyles2(getPreviewModalStyles);

  return (
    <Modal isOpen={isOpen} title={title} onDismiss={onDismiss} className={styles.modal}>
      {isLoading ? (
        <Stack direction="row" gap={2} alignItems="center" justifyContent="center">
          <Spinner />
          <Text>{t('alerting.import-to-gma.preview.loading', 'Loading content...')}</Text>
        </Stack>
      ) : (
        <div className={styles.editorContainer}>
          <CodeEditor
            width="100%"
            height={500}
            language={language}
            value={content}
            monacoOptions={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              lineNumbers: 'on',
              readOnly: true,
              wordWrap: 'on',
            }}
          />
        </div>
      )}
      <Modal.ButtonRow>
        {reveal && (
          <Tooltip
            content={
              reveal.canReveal
                ? ''
                : t(
                    'alerting.import-to-gma.preview.reveal-disabled-tooltip',
                    'Nothing was redacted in this configuration.'
                  )
            }
            show={reveal.canReveal ? false : undefined}
          >
            <span className={styles.tooltipTarget}>
              <Button
                variant="secondary"
                icon={reveal.isRevealed ? 'eye-slash' : 'eye'}
                disabled={!reveal.canReveal}
                onClick={reveal.onToggle}
              >
                {reveal.isRevealed
                  ? t('alerting.import-to-gma.preview.hide-secrets', 'Hide secrets')
                  : t('alerting.import-to-gma.preview.reveal-secrets', 'Reveal secrets')}
              </Button>
            </span>
          </Tooltip>
        )}
        <Button variant="secondary" onClick={onDismiss}>
          {t('alerting.common.close', 'Close')}
        </Button>
      </Modal.ButtonRow>
    </Modal>
  );
}

const getPreviewModalStyles = (theme: GrafanaTheme2) => ({
  modal: css({
    width: '900px',
    maxWidth: '90vw',
  }),
  editorContainer: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  tooltipTarget: css({
    display: 'inline-flex',
  }),
});
