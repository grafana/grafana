import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';

import { AI_PURPLE } from '../logic/flows';
import { COAUTHOR_KEYS } from '../logic/highlightV2';

import { type Pos } from './KeyboardPopover';

/** Approximate rendered size, used to centre / clamp the bar before layout. */
export const TOOLBAR_WIDTH = 420;
export const TOOLBAR_HEIGHT = 36;

interface Props {
  pos: Pos;
  copied: boolean;
  onCopy: () => void;
  onQueryMap: () => void;
  onCoauthor: () => void;
  /** The MVP flow ships without the query map. */
  showQueryMap?: boolean;
}

/**
 * Highlight-flow v2: highlighting part of the query offers this bar. Copy and
 * Query map act immediately; only Coauthor (or its shortcut) brings in AI.
 */
export function SelectionToolbar({ pos, copied, onCopy, onQueryMap, onCoauthor, showQueryMap = true }: Props) {
  const styles = useStyles2(getStyles);
  return (
    <div
      className={styles.bar}
      style={{ left: pos.left, top: pos.top }}
      // Acting on the highlight means not losing it to a focus change first.
      onMouseDown={(e) => e.preventDefault()}
      data-coauthor-toolbar
    >
      <button className={styles.item} onClick={onCopy}>
        <Icon name={copied ? 'check' : 'clipboard-alt'} size="sm" />
        {copied ? 'Copied' : 'Copy'}
      </button>
      {showQueryMap && (
        <button className={styles.item} onClick={onQueryMap}>
          <Icon name="sitemap" size="sm" /> Query map
        </button>
      )}
      <span className={styles.divider} />
      <button className={styles.item} onClick={onCoauthor}>
        <Icon name="ai-sparkle" size="sm" style={{ color: AI_PURPLE }} />
        <span style={{ color: AI_PURPLE }}>Coauthor</span>
        <span className={styles.keys}>{COAUTHOR_KEYS.join('+')}</span>
      </button>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    position: 'absolute',
    zIndex: 21,
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5),
    borderRadius: 8,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z3,
    whiteSpace: 'nowrap',
  }),
  item: css({
    all: 'unset',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1.25),
    borderRadius: 6,
    color: theme.colors.text.primary,
    fontSize: theme.typography.bodySmall.fontSize,
    cursor: 'pointer',
    '&:hover': { background: theme.colors.background.secondary },
  }),
  divider: css({
    width: 1,
    alignSelf: 'stretch',
    margin: theme.spacing(0.5, 0.5),
    background: theme.colors.border.weak,
  }),
  keys: css({ color: theme.colors.text.disabled, fontFamily: theme.typography.fontFamilyMonospace, fontSize: 11 }),
});
