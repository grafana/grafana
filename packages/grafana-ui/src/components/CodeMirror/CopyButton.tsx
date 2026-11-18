import { type EditorView } from '@codemirror/view';
import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';
import { ClipboardButton } from '../ClipboardButton/ClipboardButton';
import { InlineToast } from '../InlineToast/InlineToast';

const SHOW_ERROR_DURATION = 2 * 1000;

export function CopyButton({ view }: { view: EditorView }) {
  const styles = useStyles2(getStyles);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [showCopyError, setShowCopyError] = useState(false);

  useEffect(() => {
    if (!showCopyError) {
      return;
    }

    const timeoutId = setTimeout(() => setShowCopyError(false), SHOW_ERROR_DURATION);
    return () => clearTimeout(timeoutId);
  }, [showCopyError]);

  const label = t('grafana-ui.code-mirror.copy', 'Copy to clipboard');

  return createPortal(
    <div ref={setContainer} className={styles.container}>
      {showCopyError && (
        <InlineToast placement="top" referenceElement={container}>
          {t('grafana-ui.code-mirror.copy-failed', 'Could not copy to clipboard')}
        </InlineToast>
      )}
      <ClipboardButton
        icon="copy"
        variant="secondary"
        size="sm"
        aria-label={label}
        tooltip={label}
        getText={() => view.state.sliceDoc()}
        onClipboardCopy={() => setShowCopyError(false)}
        onClipboardError={() => setShowCopyError(true)}
      />
    </div>,
    view.dom
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    zIndex: 1,
    display: 'flex',
  }),
});
