import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TextLink, useStyles2 } from '@grafana/ui';

import { type Frontmatter, isYamlMapping } from '../../utils/markdownFrontmatter';

interface Props {
  data: Frontmatter;
}

// Lists and mappings render as inner tables down to this depth; anything deeper
// is shown as JSON so a deeply nested document can't blow up the layout.
const MAX_NESTING = 2;

/**
 * GitHub-style metadata table for a document's YAML front matter: one row per
 * top-level key. Values only ever reach the DOM through React bindings, so
 * nothing from the file is rendered as HTML.
 */
export function MarkdownFrontmatterTable({ data }: Props) {
  const styles = useStyles2(getStyles);
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return null;
  }

  return (
    <div className={styles.scroll}>
      <table className={styles.table} aria-label={t('browse-dashboards.readme.metadata-label', 'Document metadata')}>
        <MappingRows entries={entries} depth={0} />
      </table>
    </div>
  );
}

function MappingRows({ entries, depth }: { entries: Array<[string, unknown]>; depth: number }) {
  return (
    <tbody>
      {entries.map(([key, value]) => (
        <tr key={key}>
          <th scope="row">{key}</th>
          <td>
            <FrontmatterValue value={value} depth={depth} />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

function FrontmatterValue({ value, depth }: { value: unknown; depth: number }) {
  const styles = useStyles2(getStyles);

  if (typeof value === 'string') {
    return isHttpUrl(value) ? (
      <TextLink href={value} external>
        {value}
      </TextLink>
    ) : (
      <>{value}</>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0 || depth >= MAX_NESTING) {
      return <>{JSON.stringify(value)}</>;
    }
    // A list is one row of cells, like GitHub lays it out.
    return (
      <table className={cx(styles.nested, styles.list)}>
        <tbody>
          <tr>
            {value.map((item, index) => (
              <td key={index}>
                <FrontmatterValue value={item} depth={depth + 1} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    );
  }

  if (isYamlMapping(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0 || depth >= MAX_NESTING) {
      return <>{JSON.stringify(value)}</>;
    }
    return (
      <table className={styles.nested}>
        <MappingRows entries={entries} depth={depth + 1} />
      </table>
    );
  }

  return <>{String(value)}</>;
}

function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The panel clips overflow, so a table wider than the panel scrolls instead of being cut off.
  scroll: css({
    overflowX: 'auto',
    marginBottom: theme.spacing(2),
  }),
  // Borders and padding match the tables marked renders in the body below.
  table: css({
    borderCollapse: 'collapse',
    'th, td': {
      border: `1px solid ${theme.colors.border.medium}`,
      padding: theme.spacing(0.5, 1),
      textAlign: 'left',
      verticalAlign: 'top',
      // A long value (typically a URL) wraps rather than widening the table.
      overflowWrap: 'anywhere',
    },
    th: {
      fontWeight: theme.typography.fontWeightMedium,
      backgroundColor: theme.colors.background.secondary,
    },
    // Multi-line values (YAML block scalars) keep their line breaks.
    td: {
      whiteSpace: 'pre-line',
    },
  }),
  nested: css({
    borderCollapse: 'collapse',
  }),
  // List items share one row; keep each one whole and let the row scroll rather
  // than squeezing them into letter-wrapped slivers.
  list: css({
    '& > tbody > tr > td': {
      whiteSpace: 'nowrap',
    },
  }),
});
