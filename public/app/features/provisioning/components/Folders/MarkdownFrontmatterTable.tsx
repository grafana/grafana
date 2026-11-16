import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { TextLink, useStyles2 } from '@grafana/ui';
import { isHttpUrl } from 'app/core/utils/url';

import { type YamlMapping, type YamlNode } from '../../utils/markdownFrontmatter';

interface Props {
  data: YamlMapping;
}

// Lists and mappings render as inner tables down to this depth; anything deeper
// is shown as a placeholder so a deeply nested document can't blow up the layout.
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

  // `markdown-html` gives the table the same borders, padding and link styling
  // as tables in the document body, so the two can't drift apart.
  return (
    <div className={cx('markdown-html', styles.scroll)}>
      <table className={styles.table} aria-label={t('browse-dashboards.readme.metadata-label', 'Document metadata')}>
        <MappingRows entries={entries} depth={0} />
      </table>
    </div>
  );
}

function MappingRows({ entries, depth }: { entries: Array<[string, YamlNode]>; depth: number }) {
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

// A list is one row of cells, like GitHub lays it out.
function ListRow({ items, depth }: { items: YamlNode[]; depth: number }) {
  const styles = useStyles2(getStyles);
  return (
    <table className={styles.list}>
      <tbody>
        <tr>
          {items.map((item, index) => (
            <td key={index}>
              <FrontmatterValue value={item} depth={depth} />
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

function FrontmatterValue({ value, depth }: { value: YamlNode; depth: number }) {
  if (typeof value === 'string') {
    return isHttpUrl(value) ? (
      <TextLink href={value} external>
        {value}
      </TextLink>
    ) : (
      <>{value}</>
    );
  }

  // A key with no value (`owner:`) gets an empty cell, like GitHub shows it.
  if (value === null) {
    return null;
  }

  const isList = Array.isArray(value);

  // Never serialize the parsed YAML: anchors can make it cyclic (JSON.stringify
  // throws) or expand a few aliased lines into megabytes. Containers we don't
  // expand get a fixed-size stand-in instead.
  const isEmpty = Object.keys(value).length === 0;
  if (isEmpty || depth >= MAX_NESTING) {
    const inner = isEmpty ? '' : '…';
    const placeholder = isList ? `[${inner}]` : `{${inner}}`;
    return <>{placeholder}</>;
  }

  return isList ? (
    <ListRow items={value} depth={depth + 1} />
  ) : (
    <table>
      <MappingRows entries={Object.entries(value)} depth={depth + 1} />
    </table>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // The panel clips overflow, so a table wider than the panel scrolls instead of being cut off.
  scroll: css({
    overflowX: 'auto',
    marginBottom: theme.spacing(2),
  }),
  table: css({
    'th, td': {
      verticalAlign: 'top',
      // A long value (typically a URL) wraps rather than widening the table.
      overflowWrap: 'anywhere',
    },
    // Multi-line values (YAML block scalars) keep their line breaks.
    td: {
      whiteSpace: 'pre-line',
    },
  }),
  // List items share one row; keep each one whole and let the row scroll rather
  // than squeezing them into letter-wrapped slivers.
  list: css({
    '& > tbody > tr > td': {
      whiteSpace: 'nowrap',
    },
  }),
});
