import { css, cx } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { AdHocVariableFilter, GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  AdHocFiltersVariable,
  GroupByVariable,
  SceneComponentProps,
  SceneObjectBase,
  SceneQueryRunner,
  VizPanel,
  getNonApplicablePillStyles,
  sceneGraph,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

const CHAR_WIDTH_ESTIMATE = 7;
const PILL_PADDING = 24;
const GAP_SIZE = 8;
const OVERFLOW_PILL_WIDTH = 100;

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
  const nonApplicablePillStyles = useStyles2(getNonApplicablePillStyles);
  const localStyles = useStyles2(getLocalStyles);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nonApplicables, setNonApplicables] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(0);

  const filtersState = filtersVariable?.useState();
  const groupByState = groupByVariable?.useState();

  useEffect(() => {
    const queries = data.$data instanceof SceneQueryRunner ? data.$data.state.queries : [];
    const filters = filtersState?.filters ?? [];
    const originFilters = filtersState?.originFilters ?? [];
    const groupByValue = groupByState?.value ?? [];
    const allFilters = [...filters, ...originFilters];

    const fetchApplicability = async () => {
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
    };

    fetchApplicability();
  }, [filtersVariable, filtersState, groupByVariable, groupByState, data]);

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
        const availableWidth = isLastPill ? containerWidth : containerWidth - OVERFLOW_PILL_WIDTH - GAP_SIZE;

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

  return (
    <div ref={containerRef} className={localStyles.container}>
      {visibleFilters.map((filter, index) => (
        <div
          key={index}
          className={cx(nonApplicablePillStyles.disabledPill, nonApplicablePillStyles.strikethrough, localStyles.pill)}
        >
          {filter}
        </div>
      ))}
      {hasOverflow && (
        <div className={cx(nonApplicablePillStyles.disabledPill, localStyles.pill, localStyles.overflowPill)}>
          + {remainingCount}{' '}
          {remainingCount === 1
            ? t('panel.sub-header.non-applicables.count.filter', 'filter')
            : t('panel.sub-header.non-applicables.count.filters', 'filters')}
        </div>
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
      padding: theme.spacing(0.25, 0.75),
      borderRadius: theme.shape.radius.default,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }),
    overflowPill: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
}
