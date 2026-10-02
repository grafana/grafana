import { type DataFrame } from '@grafana/data';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type AdHocFilterItem, type FilterByGroupedLabelsModel } from '@grafana/ui';
import { FILTER_FOR_OPERATOR, FILTER_OUT_OPERATOR } from '@grafana/ui/internal';

export function getGroupedFilters(
  frame: DataFrame,
  seriesIdx: number,
  getFiltersBasedOnGrouping: (filters: AdHocFilterItem[]) => AdHocFilterItem[]
) {
  const groupingFilters: AdHocFilterItem[] = [];
  const xField = frame.fields[seriesIdx];

  if (xField && xField.labels && xField.config.filterable) {
    const seriesFilters: AdHocFilterItem[] = [];

    Object.entries(xField.labels).forEach(([key, value]) => {
      seriesFilters.push({
        key,
        operator: FILTER_FOR_OPERATOR,
        value,
      });
    });

    groupingFilters.push(...getFiltersBasedOnGrouping(seriesFilters));
  }

  return groupingFilters;
}

interface FilterByGroupedLabelsOptions {
  /**
   * The timeseries panel's tooltip filtering shipped with `dashboardUnifiedDrilldownControls` (GA) and
   * must keep working when the experimental `grafana.filterablePanels` flag is off, so it opts out.
   */
  checkFilterablePanelsFlag?: boolean;
}

export function getFilterByGroupedLabels(
  frame: DataFrame,
  seriesIdx: number | null | undefined,
  getFiltersBasedOnGrouping: ((items: AdHocFilterItem[]) => AdHocFilterItem[]) | undefined,
  onAddAdHocFilters: ((items: AdHocFilterItem[]) => void) | undefined,
  { checkFilterablePanelsFlag = true }: FilterByGroupedLabelsOptions = {}
): FilterByGroupedLabelsModel | undefined {
  if (checkFilterablePanelsFlag && !getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaFilterablePanels, false)) {
    return undefined;
  }

  if (seriesIdx == null || getFiltersBasedOnGrouping == null || onAddAdHocFilters == null) {
    return undefined;
  }

  const groupingFilters = getGroupedFilters(frame, seriesIdx, getFiltersBasedOnGrouping);

  if (groupingFilters.length === 0) {
    return undefined;
  }

  return {
    onFilterForGroupedLabels: () => {
      onAddAdHocFilters(groupingFilters);
    },
    onFilterOutGroupedLabels: () => {
      onAddAdHocFilters(groupingFilters.map((item) => ({ ...item, operator: FILTER_OUT_OPERATOR })));
    },
  };
}
