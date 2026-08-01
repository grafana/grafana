import { css } from '@emotion/css';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Text, useStyles2 } from '@grafana/ui';

import { type ResolvedCell } from '../../model/notebookSpec';

interface Props {
  cell: ResolvedCell;
  onExpand: () => void;
}

/** Compact one-line summary shown instead of the body when a cell is collapsed. */
export function CollapsedCellSummary({ cell, onExpand }: Props) {
  const styles = useStyles2(getStyles);
  const { icon, summary } = describeCell(cell);

  return (
    <button
      type="button"
      className={styles.row}
      onClick={onExpand}
      aria-label={t('notebooks.collapsed-cell.expand', 'Expand block')}
    >
      <Icon name={icon} size="sm" />
      <span className={styles.summary}>{summary}</span>
      <Text variant="bodySmall" color="secondary">
        {t('notebooks.collapsed-cell.hint', 'collapsed')}
      </Text>
    </button>
  );
}

function describeCell(cell: ResolvedCell): { icon: IconName; summary: string } {
  const { element } = cell;

  if (element.kind === 'Panel' || element.kind === 'LibraryPanel') {
    return { icon: 'graph-bar', summary: element.spec.title || t('notebooks.collapsed-cell.panel', 'Panel') };
  }

  const content = element.spec.content;
  if (content.kind === 'Code') {
    const lines = content.spec.code.split('\n').length;
    return {
      icon: 'brackets-curly',
      summary: t('notebooks.collapsed-cell.code', '', {
        language: content.spec.language || 'code',
        count: lines,
        defaultValue_one: '{{language}} · {{count}} line',
        defaultValue_other: '{{language}} · {{count}} lines',
      }),
    };
  }

  const firstLine =
    content.spec.text
      .split('\n')
      .map((line) => line.replace(/^[#>\-*\s`]+/, '').trim())
      .find((line) => line.length > 0) ?? '';
  return {
    icon: 'text-fields',
    summary: firstLine.slice(0, 80) || t('notebooks.collapsed-cell.empty-text', 'Empty text cell'),
  };
}

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    width: '100%',
    background: theme.colors.background.secondary,
    border: 'none',
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(1, 1.5),
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    textAlign: 'left',

    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  summary: css({
    flex: 1,
    minWidth: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
});
