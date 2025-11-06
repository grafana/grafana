import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AdHocVariableFilter, GrafanaTheme2 } from '@grafana/data';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneComponentProps,
  SceneObjectBase,
  VizPanel,
  sceneGraph,
} from '@grafana/scenes';
import { Tooltip, useStyles2 } from '@grafana/ui';

const CHAR_WIDTH_ESTIMATE = 6;
const PILL_PADDING = 8;
const GAP_SIZE = 8;

export class PanelNonApplicableFiltersSubHeader extends SceneObjectBase {
  static Component = PanelNonApplicableFiltersSubHeaderRenderer;

  constructor() {
    super({});
    this.addActivationHandler(this.onActivate);
  }

  private onActivate = () => {
    const panel = this.parent;
    if (!panel || !(panel instanceof VizPanel)) {
      throw new Error('PanelNonApplicableFiltersSubHeader can be used only for VizPanel');
    }
  };

  public getAdHocFiltersVariable(): AdHocFiltersVariable | undefined {
    return sceneGraph.getVariables(this).state.variables.find((variable) => variable instanceof AdHocFiltersVariable);
  }

  public getGroupByVariable(): GroupByVariable | undefined {
    return sceneGraph.getVariables(this).state.variables.find((variable) => variable instanceof GroupByVariable);
  }
}

function formatFilterLabel(filter: AdHocVariableFilter): string {
  return `${filter.key} ${filter.operator} ${filter.value}`;
}

function estimatePillWidth(text: string): number {
  return text.length * CHAR_WIDTH_ESTIMATE + PILL_PADDING;
}

function PanelNonApplicableFiltersSubHeaderRenderer({
  model,
}: SceneComponentProps<PanelNonApplicableFiltersSubHeader>) {
  const dataObject = sceneGraph.getData(model);
  const data = dataObject.useState();
  const filtersVariable = model.getAdHocFiltersVariable();
  const groupByVariable = model.getGroupByVariable();
  const localStyles = useStyles2(getLocalStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nonApplicables, setNonApplicables] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(0);

  const filtersState = filtersVariable?.useState();
  const groupByState = groupByVariable?.useState();

  const fetchApplicability = useCallback(async () => {
    const queries = data.data?.request?.targets ?? [];
    const filters = filtersState?.filters ?? [];
    const originFilters = filtersState?.originFilters ?? [];
    const groupByValue = groupByState?.value ?? [];
    const allFilters = [...filters, ...originFilters];

    const nonApplicables: string[] = [];

    if (filtersVariable && allFilters.length > 0) {
      const applicability = await filtersVariable.getFiltersApplicabilityForQueries(allFilters, queries);
      const nonApplicableFilters = allFilters.filter((filter) => {
        const result = applicability?.find((r) => r.key === filter.key && r.origin === filter.origin);
        return !result?.applicable;
      });
      nonApplicables.push(...nonApplicableFilters.map(formatFilterLabel));
    }

    if (groupByVariable) {
      const applicability = await groupByVariable.getGroupByApplicabilityForQueries(groupByValue, queries);
      const nonApplicableKeys = applicability?.filter((r) => !r.applicable).map((r) => r.key) ?? [];
      nonApplicables.push(...nonApplicableKeys);
    }

    setNonApplicables(nonApplicables);
  }, [data, filtersState, groupByState, filtersVariable, groupByVariable]);

  useEffect(() => {
    fetchApplicability();
  }, [fetchApplicability]);

  // calculates how many pills fit in the available width
  useEffect(() => {
    if (!containerRef.current || nonApplicables.length === 0) {
      return;
    }

    const calculateVisiblePills = () => {
      const containerWidth = containerRef.current?.offsetWidth || 0;
      let totalWidth = 0;
      let count = 0;

      for (let i = 0; i < nonApplicables.length; i++) {
        const pillWidth = estimatePillWidth(nonApplicables[i]);
        const gapWidth = count > 0 ? GAP_SIZE : 0;
        const neededWidth = totalWidth + pillWidth + gapWidth;

        const isLastPill = i === nonApplicables.length - 1;

        // Calculate available width: if not last pill, reserve space for overflow pill
        let availableWidth = containerWidth;
        if (!isLastPill) {
          const remainingAfterThis = nonApplicables.length - (i + 1);
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
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [nonApplicables]);

  if (nonApplicables.length === 0) {
    return null;
  }

  const visibleFilters = nonApplicables.slice(0, visibleCount);
  const remainingCount = nonApplicables.length - visibleCount;
  const hasOverflow = remainingCount > 0;
  const remainingFilters = nonApplicables.slice(visibleCount);

  return (
    <div ref={containerRef} className={localStyles.container}>
      {visibleFilters.map((filter, index) => (
        <div key={index} className={cx(localStyles.disabledPill, localStyles.strikethrough, localStyles.pill)}>
          {filter}
        </div>
      ))}
      {hasOverflow && (
        <Tooltip content={remainingFilters.join(', ')}>
          <div className={cx(localStyles.disabledPill, localStyles.pill)}>+{remainingCount}</div>
        </Tooltip>
      )}
    </div>
  );
}

function getLocalStyles(theme: GrafanaTheme2) {
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
