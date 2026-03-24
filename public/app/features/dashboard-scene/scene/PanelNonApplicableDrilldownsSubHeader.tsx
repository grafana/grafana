import { css, cx } from '@emotion/css';
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { AdHocFiltersVariable, GroupByVariable, SceneQueryRunner } from '@grafana/scenes';
import { Tooltip, measureText, useStyles2, useTheme2 } from '@grafana/ui';

import { getDrilldownApplicability } from '../utils/drilldownUtils';
import { t } from '@grafana/i18n';

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

  // Subscribe to state changes (this triggers re-renders when state changes)
  const filtersState = filtersVar?.useState();
  const groupByState = groupByVar?.useState();
  const { queries } = queryRunner.useState();

  const [nonApplicable, setNonApplicable] = useState<NonApplicableItem[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(0);

  // Create stable string representations to detect actual changes
  const filterKey = useMemo(() => {
    const filters = filtersState?.filters ?? [];
    const originFilters = filtersState?.originFilters ?? [];
    const filterValues = [...filters, ...originFilters];
    return JSON.stringify(
      filterValues.map((f) => `${f.key}${f.operator}${f.values?.join(',') ?? f.value}${f.origin ?? ''}`)
    );
  }, [filtersState?.filters, filtersState?.originFilters]);

  const groupByKey = useMemo(() => {
    const value = groupByState?.value ?? [];
    const groupByValues = Array.isArray(value) ? value : value ? [value] : [];
    // Include keysApplicability in the key so we re-fetch when it changes
    const keysApplicabilityKey = JSON.stringify(groupByState?.keysApplicability?.map((keyApp) => keyApp.key) ?? []);
    return JSON.stringify(groupByValues) + keysApplicabilityKey;
  }, [groupByState?.value, groupByState?.keysApplicability]);

  useEffect(() => {
    const fetchApplicability = async () => {
      const filters = filtersState?.filters ?? [];
      const originFilters = filtersState?.originFilters ?? [];
      const value = groupByState?.value ?? [];

      const filterValues = [...filters, ...originFilters];
      const groupByValues = Array.isArray(value) ? value : value ? [value] : [];

      const items: NonApplicableItem[] = [];

      const applicability = await getDrilldownApplicability(queryRunner, filtersVar, groupByVar);
      if (filterValues.length) {
        for (const filter of filterValues) {
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

      if (groupByValues.length) {
        const groupByApplicability = groupByState?.keysApplicability;

        for (const groupByKey of groupByValues) {
          const apiResult = applicability?.find((entry) => entry.key === groupByKey);
          if (apiResult && !apiResult.applicable) {
            items.push({ label: String(groupByKey), reason: apiResult.reason });
          } else if (!apiResult) {
            const stateResult = groupByApplicability?.find((entry) => entry.key === groupByKey);
            if (stateResult && !stateResult.applicable) {
              items.push({ label: String(groupByKey), reason: stateResult.reason });
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
