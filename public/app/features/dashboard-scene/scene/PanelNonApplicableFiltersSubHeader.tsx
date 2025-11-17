import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DataQuery, GrafanaTheme2 } from '@grafana/data';
import { AdHocFiltersVariable, GroupByVariable } from '@grafana/scenes';
import { Tooltip, measureText, useStyles2, useTheme2 } from '@grafana/ui';

const GAP_SIZE = 8;
const FONT_SIZE = 12;

interface Props {
  filtersVar?: AdHocFiltersVariable;
  groupByVar?: GroupByVariable;
  queries: DataQuery[];
}

export function PanelNonApplicableFiltersSubHeader({ filtersVar, groupByVar, queries }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();

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

  const fetchApplicability = useCallback(async () => {
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
  }, [filtersVar, groupByVar, filters, groupByValues, queries]);

  useEffect(() => {
    fetchApplicability();
  }, [fetchApplicability]);

  useLayoutEffect(() => {
    if (!nonApplicable.length) {
      setVisibleCount(0);
      return;
    }

    setVisibleCount(calculateVisibleCount(nonApplicable, containerWidth, theme));
  }, [containerWidth, nonApplicable, theme]);

  if (nonApplicable.length === 0) {
    return null;
  }

  const visibleFilters = nonApplicable.slice(0, visibleCount);
  const remainingCount = nonApplicable.length - visibleCount;
  const hasOverflow = remainingCount > 0;
  const remainingFilters = nonApplicable.slice(visibleCount);

  return (
    <div ref={sizeRef} className={styles.container}>
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

function getPillWidth(label: string) {
  return Math.ceil(measureText(label, FONT_SIZE).width) + GAP_SIZE;
}

function calculateVisibleCount(labels: string[], containerWidth: number, theme: GrafanaTheme2) {
  let usedWidth = 0;
  let visible = 0;

  for (let i = 0; i < labels.length; i++) {
    const pillWidth = getPillWidth(labels[i]);
    const gapBefore = visible > 0 ? GAP_SIZE : 0;
    const nextWidth = usedWidth + gapBefore + pillWidth;
    const remaining = labels.length - (i + 1);

    if (remaining > 0) {
      const overflowWidth = getPillWidth(`+${remaining}`);
      if (nextWidth + GAP_SIZE + overflowWidth > containerWidth) {
        break;
      }
    } else if (nextWidth > containerWidth) {
      break;
    }

    usedWidth = nextWidth;
    visible++;
  }

  return visible;
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
