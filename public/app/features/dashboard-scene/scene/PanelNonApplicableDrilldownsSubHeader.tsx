import { css, cx } from '@emotion/css';
import { useLayoutEffect, useMemo, useState } from 'react';
import { useMeasure } from 'react-use';

import { DrilldownsApplicability, GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { AdHocFiltersVariable, buildApplicabilityMatcher } from '@grafana/scenes';
import { Tooltip, measureText, useStyles2, useTheme2 } from '@grafana/ui';

const GAP_SIZE = 8;
const FONT_SIZE = 12;

interface Props {
  filtersVar?: AdHocFiltersVariable;
  applicability?: DrilldownsApplicability[];
}

export function PanelNonApplicableDrilldownsSubHeader({ filtersVar, applicability }: Props) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const [sizeRef, { width: containerWidth }] = useMeasure<HTMLDivElement>();

  const filtersState = filtersVar?.useState();
  const [visibleCount, setVisibleCount] = useState<number>(0);

  const nonApplicable = useMemo(() => {
    if (!applicability?.length) {
      return [];
    }

    const items: Array<{ label: string; reason?: string }> = [];
    const filters = filtersState?.filters ?? [];
    const originFilters = filtersState?.originFilters ?? [];
    const filterValues = [...originFilters, ...filters];

    if (filterValues.length) {
      const matchFilter = buildApplicabilityMatcher(applicability);

      for (let i = 0; i < filterValues.length; i++) {
        const filter = filterValues[i];
        const result = matchFilter(filter.key, filter.origin, i);
        const isNonApplicable = result ? !result.applicable : Boolean(filter.nonApplicable);
        const reason = result?.reason ?? filter.nonApplicableReason;

        if (isNonApplicable) {
          const displayValue = filter.values?.length ? filter.values.join(', ') : filter.value;
          items.push({ label: `${filter.key} ${filter.operator} ${displayValue}`, reason });
        }
      }
    }

    return items;
  }, [filtersState, applicability]);

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
