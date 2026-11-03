import { css, cx } from '@emotion/css';
import { useLayoutEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Tag, Tooltip, useStyles2 } from '@grafana/ui';

import { fitVisibleCount } from './fitVisibleCount';

/**
 * Fits dashboard tags into the palette's remaining row space by measuring full tags and overflow labels.
 * Shows the longest prefix that fits with its remaining-tag count, reserving room for one truncated tag and a count.
 * At least one tag stays visible and may truncate; the count's tooltip shows all hidden tags as colored pills.
 */
export function ResultTags({ tags }: { tags: string[] }) {
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const tagMeasurementsRef = useRef<HTMLDivElement>(null);
  const countMeasurementsRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(1);

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
      const availableWidth = container.getBoundingClientRect().width;
      const widths = Array.from(tagMeasurements.children, (tag) => tag.getBoundingClientRect().width);
      const countWidths = Array.from(countMeasurements.children, (count) => count.getBoundingClientRect().width);
      setVisibleCount(fitVisibleCount(widths, countWidths, gap, availableWidth));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    // Font and theme changes can resize tags without resizing the row.
    observer.observe(tagMeasurements);
    observer.observe(countMeasurements);
    return () => observer.disconnect();
  }, [tags, styles]);

  const displayedCount = Math.min(visibleCount, tags.length);
  const hiddenTags = tags.slice(displayedCount);

  return (
    <div ref={containerRef} className={styles.container}>
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
                    <Tag key={tag} name={tag} className={styles.tooltipTag} />
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
    alignSelf: 'center',
    justifyContent: 'flex-end',
    flex: '1 0 0',
    minWidth: 'min(96px, 25%)',
    overflow: 'hidden',
  }),
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
  hiddenTags: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.75),
  }),
  tooltipTag: css({
    maxWidth: '100%',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
  }),
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
