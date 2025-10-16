import { css, cx } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { DrilldownsApplicability, GrafanaTheme2 } from '@grafana/data';
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
  const { filters, originFilters } = filtersState || { filters: [], originFilters: [] };

  const groupByState = groupByVariable?.useState();
  const { value } = groupByState || { value: [] };

  useEffect(() => {
    const queries = data.$data instanceof SceneQueryRunner ? data.$data.state.queries : [];
    const allFilters = [...filters, ...(originFilters ?? [])];

    const fetchApplicability = async () => {
      let response: DrilldownsApplicability[] | undefined;
      const nonApplicables = [];

      if (filtersVariable) {
        response = await filtersVariable.getFiltersApplicabilityForQueries(allFilters, queries);

        nonApplicables.push(
          ...allFilters
            .filter((filter) => {
              const applicability = response?.find((r) => r.key === filter.key && r.origin === filter.origin);
              return !applicability?.applicable;
            })
            .map((filter) => `${filter.key} ${filter.operator} ${filter.value}`)
        );
      }

      if (groupByVariable) {
        response = await groupByVariable.getGroupByApplicabilityForQueries(value, queries);

        nonApplicables.push(...(response?.filter((r) => !r.applicable).map((r) => r.key) ?? []));
      }

      setNonApplicables(nonApplicables);
    };

    fetchApplicability();
  }, [filtersVariable, filters, originFilters, data, groupByVariable, value]);

  // calculates how many pills fit in the available width
  useEffect(() => {
    if (!containerRef.current || nonApplicables.length === 0) {
      return;
    }

    const calculateVisiblePills = () => {
      const containerWidth = containerRef.current?.offsetWidth || 0;
      const GAP = 8;
      const OVERFLOW_PILL_WIDTH = 100;

      let totalWidth = 0;
      let count = 0;

      for (let i = 0; i < nonApplicables.length; i++) {
        const text = nonApplicables[i];
        const estimatedWidth = text.length * 7 + 24; // ~7px per char + padding

        const neededWidth = totalWidth + estimatedWidth + (count > 0 ? GAP : 0);

        // reserve space for the overflow indicator
        const needsOverflow = i < nonApplicables.length - 1;
        const availableWidth = needsOverflow ? containerWidth - OVERFLOW_PILL_WIDTH - GAP : containerWidth;

        if (neededWidth > availableWidth) {
          break;
        }

        totalWidth = neededWidth;
        count++;
      }

      setVisibleCount(count);
    };

    calculateVisiblePills();

    // recalculate
    const resizeObserver = new ResizeObserver(calculateVisiblePills);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [nonApplicables]);

  if (nonApplicables.length > 0) {
    const visibleFilters = nonApplicables.slice(0, visibleCount);
    const remainingCount = nonApplicables.length - visibleCount;

    return (
      <div ref={containerRef} className={localStyles.container}>
        {visibleFilters.map((filter, index) => (
          <div
            key={index}
            className={cx(
              nonApplicablePillStyles.disabledPill,
              nonApplicablePillStyles.strikethrough,
              localStyles.pill
            )}
          >
            {filter}
          </div>
        ))}
        {remainingCount > 0 && (
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

  return undefined;
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
