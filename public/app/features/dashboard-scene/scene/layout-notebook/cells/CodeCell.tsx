import { css, cx } from '@emotion/css';

import { AppEvents, type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type CellContentKind } from '@grafana/schema/apis/notebook/v2beta1';
import { Badge, CodeEditor, IconButton, Stack, useStyles2 } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';
import { copyStringToClipboard } from 'app/core/utils/explore';

const LINE_HEIGHT = 18;
const MIN_LINES = 3;
const MAX_LINES = 30;
const TOOLBAR_CLASS = 'notebook-code-cell-toolbar';

const LANGUAGE_LABELS: Record<string, string> = {
  sql: 'SQL',
  promql: 'PromQL',
  logql: 'LogQL',
  json: 'JSON',
  yaml: 'YAML',
  python: 'Python',
  go: 'Go',
  javascript: 'JavaScript',
  shell: 'Shell',
};

// Monaco needs an explicit height; approximate it from the line count so short
// snippets stay compact and long ones cap out with an internal scroll.
export function CodeCell({ content }: { content: CellContentKind }) {
  const styles = useStyles2(getStyles);

  if (content.kind !== 'Code') {
    return null;
  }

  const { code, language } = content.spec;
  const lines = code.split('\n').length;
  const height = Math.min(Math.max(lines, MIN_LINES), MAX_LINES) * LINE_HEIGHT;
  const languageLabel = language ? (LANGUAGE_LABELS[language] ?? language) : undefined;

  const onCopy = () => {
    copyStringToClipboard(code);
    appEvents.emit(AppEvents.alertSuccess, [t('dashboard.notebook-layout.code-copied', 'Code copied')]);
  };

  return (
    <div className={styles.wrapper}>
      {/* Float over the editor on hover — no reserved strip, no layout shift. */}
      <div className={cx(styles.toolbar, TOOLBAR_CLASS)}>
        <Stack direction="row" gap={1} alignItems="center">
          {languageLabel && <Badge text={languageLabel} color="darkgrey" />}
          <IconButton
            name="copy"
            size="sm"
            tooltip={t('dashboard.notebook-layout.copy-code', 'Copy code')}
            onClick={onCopy}
            data-testid="notebook-code-copy"
          />
        </Stack>
      </div>
      <CodeEditor value={code} language={language} height={height} width="100%" readOnly showLineNumbers />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
    width: '100%',
    [`&:hover .${TOOLBAR_CLASS}, &:focus-within .${TOOLBAR_CLASS}`]: {
      opacity: 1,
      pointerEvents: 'auto',
    },
  }),
  toolbar: css({
    position: 'absolute',
    top: theme.spacing(0.5),
    // Keep clear of Monaco's vertical scrollbar track.
    right: theme.spacing(2),
    zIndex: 2,
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: theme.spacing(0.25, 0, 0.25, 0.5),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    boxShadow: theme.shadows.z1,
    opacity: 0,
    pointerEvents: 'none',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create('opacity', { duration: 120 }),
    },
  }),
});
