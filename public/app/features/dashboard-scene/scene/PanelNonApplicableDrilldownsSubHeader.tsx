import { css, cx } from '@emotion/css';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AdHocFiltersVariable, isGroupByFilter, SceneQueryRunner } from '@grafana/scenes';
import { Tooltip, measureText, useStyles2, useTheme2 } from '@grafana/ui';

import { getDrilldownApplicability } from '../utils/drilldownUtils';

const GAP_SIZE = 8;
const FONT_SIZE = 12;

interface Props {
  filtersVar?: AdHocFiltersVariable;
  queryRunner: SceneQueryRunner;
}

export function PanelNonApplicableDrilldownsSubHeader({ filtersVar, queryRunner }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();

  const filtersState = filtersVar?.useState();

  const [nonApplicable, setNonApplicable] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(0);

  const filterKey = useMemo(() => {
    const filters = filtersState?.filters ?? [];
    const originFilters = filtersState?.originFilters ?? [];
    const filterValues = [...filters, ...originFilters];
    return JSON.stringify(
      filterValues.map((f) => `${f.key}${f.operator}${f.values?.join(',') ?? f.value}${f.origin ?? ''}`)
    );
  }, [filtersState?.filters, filtersState?.originFilters]);

  useEffect(() => {
    const fetchApplicability = async () => {
      const filters = filtersState?.filters ?? [];
      const originFilters = filtersState?.originFilters ?? [];
      const allFilters = [...filters, ...originFilters];

      const realFilters = allFilters.filter((f) => !isGroupByFilter(f));
      const groupByFilters = allFilters.filter((f) => isGroupByFilter(f));

      const labels: string[] = [];

      const applicability = await getDrilldownApplicability(queryRunner, filtersVar);

      if (realFilters.length) {
        const nonApplicableFilters = realFilters.filter((filter) => {
          const result = applicability?.find((entry) => entry.key === filter.key && entry.origin === filter.origin);
          return result && !result.applicable;
        });
        labels.push(
          ...nonApplicableFilters.map((filter) => {
            const displayValue = filter.values?.length ? filter.values.join(', ') : filter.value;
            return `${filter.key} ${filter.operator} ${displayValue}`;
          })
        );
      }

      if (groupByFilters.length) {
        const nonApplicableKeys = groupByFilters
          .filter((filter) => {
            const result = applicability?.find((entry) => entry.key === filter.key);
            return result && !result.applicable;
          })
          .map((filter) => filter.key);

        labels.push(...nonApplicableKeys);
      }

      setNonApplicable(labels);
    };

    fetchApplicability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, filtersVar, queryRunner]);

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
    <div
      ref={sizeRef}
      className={styles.container}
      data-testid={selectors.components.Panels.Panel.PanelNonApplicableDrilldownsSubHeader}
    >
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
