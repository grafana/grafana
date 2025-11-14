import { css, cx } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import { DataQuery, GrafanaTheme2 } from '@grafana/data';
import { AdHocFiltersVariable, GroupByVariable } from '@grafana/scenes';
import { Tooltip, useStyles2 } from '@grafana/ui';

const CHAR_WIDTH_ESTIMATE = 6;
const PILL_PADDING = 8;
const GAP_SIZE = 8;

function estimatePillWidth(text: string): number {
  return text.length * CHAR_WIDTH_ESTIMATE + PILL_PADDING;
}

interface Props {
  filtersVar?: AdHocFiltersVariable;
  groupByVar?: GroupByVariable;
  queries: DataQuery[];
}

export function PanelNonApplicableFiltersSubHeader({ filtersVar, groupByVar, queries }: Props) {
  const styles = useStyles2(getStyles);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtersState = filtersVar?.useState();
  const groupByState = groupByVar?.useState();

  const filters = useMemo(
    () => [...(filtersState?.filters ?? []), ...(filtersState?.originFilters ?? [])],
    [filtersState]
  );
  const groupByValues = useMemo(
    () => (Array.isArray(groupByState?.value) ? groupByState?.value : groupByState?.value ? [groupByState?.value] : []),
    [groupByState]
  );

  const [nonApplicable, setNonApplicable] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(0);

  useEffect(() => {
    const fetchApplicability = async () => {
      const labels: string[] = [];

      if (filtersVar && filters.length) {
        const applicability = await filtersVar.getFiltersApplicabilityForQueries(filters, queries);
        const nonApplicableFilters = filters.filter((filter) => {
          const result = applicability?.find((entry) => entry.key === filter.key && entry.origin === filter.origin);
          return !result?.applicable;
        });
        labels.push(...nonApplicableFilters.map((filter) => `${filter.key} ${filter.operator} ${filter.value}`));
      }

      if (groupByVar && groupByValues.length) {
        const applicability = await groupByVar.getGroupByApplicabilityForQueries(groupByValues, queries);
        const nonApplicableKeys = applicability?.filter((entry) => !entry.applicable).map((entry) => entry.key) ?? [];
        labels.push(...nonApplicableKeys);
      }

      setNonApplicable(labels);
    };

    fetchApplicability();
  }, [filtersVar, groupByVar, filters, groupByValues, queries]);

  useEffect(() => {
    if (!containerRef.current || nonApplicable.length === 0) {
      return;
    }

    const calculateVisiblePills = () => {
      const containerWidth = containerRef.current?.offsetWidth || 0;
      let totalWidth = 0;
      let count = 0;

      for (let i = 0; i < nonApplicable.length; i++) {
        const pillWidth = estimatePillWidth(nonApplicable[i]);
        const gapWidth = count > 0 ? GAP_SIZE : 0;
        const neededWidth = totalWidth + pillWidth + gapWidth;

        const isLastPill = i === nonApplicable.length - 1;

        let availableWidth = containerWidth;
        if (!isLastPill) {
          const remainingAfterThis = nonApplicable.length - (i + 1);
          const overflowPillWidth = estimatePillWidth(`+${remainingAfterThis}`);
          availableWidth = containerWidth - overflowPillWidth - GAP_SIZE;
        }

        if (neededWidth > availableWidth) {
          break;
        }

        totalWidth = neededWidth;
        count++;
      }

      setVisibleCount(count);
    };

    calculateVisiblePills();

    const resizeObserver = new ResizeObserver(calculateVisiblePills);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, [nonApplicable]);

  if (nonApplicable.length === 0) {
    return null;
  }

  const visibleFilters = nonApplicable.slice(0, visibleCount);
  const remainingCount = nonApplicable.length - visibleCount;
  const hasOverflow = remainingCount > 0;
  const remainingFilters = nonApplicable.slice(visibleCount);

  return (
    <div ref={containerRef} className={styles.container}>
      {visibleFilters.map((filter, index) => (
        <div key={`${filter}-${index}`} className={cx(styles.disabledPill, styles.strikethrough, styles.pill)}>
          {filter}
        </div>
      ))}
      {hasOverflow && (
        <Tooltip content={remainingFilters.join(', ')}>
          <div className={cx(styles.disabledPill, styles.pill)}>+{remainingCount}</div>
        </Tooltip>
      )}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      display: 'flex',
      flexWrap: 'nowrap',
      gap: theme.spacing(1),
      width: '100%',
      overflow: 'hidden',
    }),
    pill: css({
      padding: theme.spacing(0.2, 0.4),
      borderRadius: theme.shape.radius.default,
      whiteSpace: 'nowrap',
      flexShrink: 0,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    disabledPill: css({
      background: theme.colors.action.selected,
      color: theme.colors.text.disabled,
      border: 0,
      '&:hover': {
        background: theme.colors.action.selected,
      },
    }),
    strikethrough: css({
      textDecoration: 'line-through',
    }),
  };
}
