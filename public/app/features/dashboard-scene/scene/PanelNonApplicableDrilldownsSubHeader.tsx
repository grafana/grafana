import { css, cx } from '@emotion/css';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import type { GrafanaTheme2 } from '@grafana/data/themes';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import {
  isGroupByFilter,
  type AdHocFiltersVariable,
  type GroupByVariable,
  type SceneQueryRunner,
} from '@grafana/scenes';
import { Tooltip } from '@grafana/ui';
import { useStyles2, useTheme2 } from '@grafana/ui/themes';
import { measureText } from '@grafana/ui/utils';

import { getDrilldownApplicability } from '../utils/drilldownUtils';

const GAP_SIZE = 8;
const FONT_SIZE = 12;

interface NonApplicableItem {
  label: string;
  reason?: string;
}

interface Props {
  filtersVar?: AdHocFiltersVariable;
  groupByVar?: GroupByVariable;
  queryRunner: SceneQueryRunner;
}

export function PanelNonApplicableDrilldownsSubHeader({ filtersVar, groupByVar, queryRunner }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();

  const filtersState = filtersVar?.useState();
  const groupByState = groupByVar?.useState();
  const { queries } = queryRunner.useState();

  const useAdhocGroupBy = filtersVar?.state.enableGroupBy === true;

  const [nonApplicable, setNonApplicable] = useState<NonApplicableItem[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(0);

  const filterKey = useMemo(() => {
    const filters = filtersState?.filters ?? [];
    const originFilters = filtersState?.originFilters ?? [];
    const filterValues = [...filters, ...originFilters];
    return JSON.stringify(
      filterValues.map((f) => `${f.key}${f.operator}${f.values?.join(',') ?? f.value}${f.origin ?? ''}`)
    );
  }, [filtersState?.filters, filtersState?.originFilters]);

  const groupByKey = useMemo(() => {
    if (useAdhocGroupBy) {
      return '';
    }
    const value = groupByState?.value ?? [];
    const groupByValues = Array.isArray(value) ? value : value ? [value] : [];
    const keysApplicabilityKey = JSON.stringify(groupByState?.keysApplicability?.map((keyApp) => keyApp.key) ?? []);
    return JSON.stringify(groupByValues) + keysApplicabilityKey;
  }, [useAdhocGroupBy, groupByState?.value, groupByState?.keysApplicability]);

  useEffect(() => {
    const fetchApplicability = async () => {
      const filters = filtersState?.filters ?? [];
      const originFilters = filtersState?.originFilters ?? [];
      const allFilters = [...filters, ...originFilters];

      const realFilters = allFilters.filter((f) => !isGroupByFilter(f));

      const items: NonApplicableItem[] = [];

      const applicability = await getDrilldownApplicability(queryRunner, filtersVar, groupByVar);

      if (realFilters.length) {
        for (const filter of realFilters) {
          const result = applicability?.find((entry) => entry.key === filter.key && entry.origin === filter.origin);
          if (result && !result.applicable) {
            const displayValue = filter.values?.length ? filter.values.join(', ') : filter.value;
            items.push({
              label: `${filter.key} ${filter.operator} ${displayValue}`,
              reason: result.reason,
            });
          }
        }
      }

      if (useAdhocGroupBy) {
        const groupByFilters = allFilters.filter((f) => isGroupByFilter(f));
        for (const filter of groupByFilters) {
          const result = applicability?.find((entry) => entry.key === filter.key);
          if (result && !result.applicable) {
            items.push({ label: filter.key, reason: result.reason });
          }
        }
      } else {
        const value = groupByState?.value ?? [];
        const groupByValues = Array.isArray(value) ? value : value ? [value] : [];
        const groupByApplicability = groupByState?.keysApplicability;

        for (const key of groupByValues) {
          const apiResult = applicability?.find((entry) => entry.key === key);
          if (apiResult && !apiResult.applicable) {
            items.push({ label: String(key), reason: apiResult.reason });
          } else if (!apiResult) {
            const stateResult = groupByApplicability?.find((entry) => entry.key === key);
            if (stateResult && !stateResult.applicable) {
              items.push({ label: String(key), reason: stateResult.reason });
            }
          }
        }
      }

      setNonApplicable(items);
    };

    fetchApplicability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, groupByKey, filtersVar, groupByVar, queryRunner, queries]);

  useLayoutEffect(() => {
    if (!nonApplicable.length) {
      setVisibleCount(0);
      return;
    }

    setVisibleCount(
      calculateVisibleCount(
        nonApplicable.map((item) => item.label),
        containerWidth,
        theme
      )
    );
  }, [containerWidth, nonApplicable, theme]);

  if (nonApplicable.length === 0) {
    return null;
  }

  const visibleItems = nonApplicable.slice(0, visibleCount);
  const remainingCount = nonApplicable.length - visibleCount;
  const hasOverflow = remainingCount > 0;
  const remainingItems = nonApplicable.slice(visibleCount);
  const defaultReason = t(
    'dashboard-scene.panel-non-applicable-drilldowns-sub-header.default-reason',
    'Filter is not applicable'
  );

  return (
    <div
      ref={sizeRef}
      className={styles.container}
      data-testid={selectors.components.Panels.Panel.PanelNonApplicableDrilldownsSubHeader}
    >
      {visibleItems.map((item, index) => (
        <Tooltip key={`${item.label}-${index}`} content={item.reason ?? defaultReason} placement="bottom">
          <div className={cx(styles.disabledPill, styles.strikethrough, styles.pill)}>{item.label}</div>
        </Tooltip>
      ))}
      {hasOverflow && (
        <Tooltip content={remainingItems.map((item) => item.label).join(', ')} placement="bottom">
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
