import { css, cx } from '@emotion/css';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Tag, Tooltip, useStyles2 } from '@grafana/ui';

export function ResultTags({ tags, prefix }: { tags: string[]; prefix?: ReactNode }) {
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefixRef = useRef<HTMLSpanElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const tagMeasurementsRef = useRef<HTMLDivElement>(null);
  const countMeasurementsRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(1);
  const hasPrefix = Boolean(prefix);

  useLayoutEffect(() => {
    const list = listRef.current;
    const container = containerRef.current;
    const tagMeasurements = tagMeasurementsRef.current;
    const countMeasurements = countMeasurementsRef.current;
    if (!container || !list || !tagMeasurements || !countMeasurements) {
      return;
    }

    const measure = () => {
      const gap = parseFloat(getComputedStyle(list).columnGap || getComputedStyle(list).gap) || 0;
      const prefixWidth = prefixRef.current ? prefixRef.current.getBoundingClientRect().width + gap : 0;
      const availableWidth = container.getBoundingClientRect().width - prefixWidth;
      const widths = Array.from(tagMeasurements.children, (tag) => tag.getBoundingClientRect().width);
      const countWidths = Array.from(countMeasurements.children, (count) => count.getBoundingClientRect().width);
      let width = 0;
      let count = 1;

      for (let i = 0; i < widths.length; i++) {
        width += widths[i] + (i > 0 ? gap : 0);
        const hiddenCount = tags.length - i - 1;
        const requiredWidth = width + (hiddenCount > 0 ? gap + countWidths[hiddenCount - 1] : 0);
        if (requiredWidth <= availableWidth) {
          count = i + 1;
        }
      }

      setVisibleCount(count);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    if (prefixRef.current) {
      observer.observe(prefixRef.current);
    }
    // Font and theme changes can resize tags without resizing the row.
    observer.observe(tagMeasurements);
    observer.observe(countMeasurements);
    return () => observer.disconnect();
  }, [tags, styles, hasPrefix]);

  const displayedCount = Math.min(visibleCount, tags.length);
  const hiddenTags = tags.slice(displayedCount);

  return (
    <div ref={containerRef} className={styles.container}>
      {hasPrefix && (
        <span ref={prefixRef} className={styles.prefix}>
          {prefix}
        </span>
      )}
      <ul ref={listRef} className={styles.list} aria-label={t('command-palette.tags.label', 'Tags')}>
        {tags.slice(0, displayedCount).map((tag) => (
          <li key={tag} className={cx(styles.item, displayedCount === 1 && styles.shrink)}>
            <Tag name={tag} title={tag} className={styles.tag} />
          </li>
        ))}
        {hiddenTags.length > 0 && (
          <li className={styles.item}>
            <Tooltip
              content={
                <div className={styles.hiddenTags}>
                  {hiddenTags.map((tag) => (
                    <div key={tag}>{tag}</div>
                  ))}
                </div>
              }
            >
              <span className={styles.more}>+{hiddenTags.length}</span>
            </Tooltip>
          </li>
        )}
      </ul>
      {/* Measure full tags separately so truncation never changes the next fit calculation. */}
      <div className={styles.measurements} aria-hidden="true">
        <div ref={tagMeasurementsRef} className={styles.measurementRow}>
          {tags.map((tag) => (
            <Tag key={tag} name={tag} className={styles.tag} />
          ))}
        </div>
        <div ref={countMeasurementsRef} className={styles.measurementRow}>
          {tags.slice(1).map((_, i) => (
            <span key={i + 1} className={styles.more}>
              +{i + 1}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(0.75),
    // Use space left by the name and subtitle, reserving one truncated tag and its count.
    flex: '1 0 0',
    minWidth: 'min(96px, 25%)',
    overflow: 'hidden',
  }),
  prefix: css({ display: 'flex', flexShrink: 0 }),
  list: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: theme.spacing(0.75),
    padding: 0,
    margin: 0,
    listStyle: 'none',
    minWidth: 0,
  }),
  item: css({
    flex: '0 0 auto',
    minWidth: 0,
  }),
  shrink: css({ flexShrink: 1 }),
  tag: css({
    display: 'block',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),
  more: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
    whiteSpace: 'nowrap',
  }),
  hiddenTags: css({ overflowWrap: 'anywhere' }),
  measurements: css({
    position: 'absolute',
    top: 0,
    left: 0,
    width: 'max-content',
    visibility: 'hidden',
    pointerEvents: 'none',
  }),
  measurementRow: css({ display: 'flex' }),
});
