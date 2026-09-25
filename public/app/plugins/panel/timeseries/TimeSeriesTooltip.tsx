import { type ReactNode } from 'react';

import {
  type DataFrame,
  type Field,
  FieldType,
  formattedValueToString,
  type InterpolateFunction,
  type LinkModel,
  usePluginContext,
} from '@grafana/data';
import { SortOrder, type TimeCompareColorMode, TooltipDisplayMode } from '@grafana/schema';
import {
  type AdHocFilterModel,
  type FilterByGroupedLabelsModel,
  type VizTooltipItem,
  VizTooltipContent,
  VizTooltipFooter,
  VizTooltipHeader,
  VizTooltipWrapper,
  getFieldDisplayItems,
  isTooltipScrollable,
} from '@grafana/ui';
import { AssistantTooltipButton } from 'app/core/components/AssistantTooltip/AssistantTooltipButton';
import { type AssistantTooltipContext } from 'app/core/components/AssistantTooltip/buildAssistantContext';

import { getFieldActions } from '../status-history/utils';

// exemplar / annotation / time region hovering?
// add annotation UI / alert dismiss UI?

export interface TimeSeriesTooltipProps {
  // aligned series frame
  series: DataFrame;

  // aligned fields that are not series
  _rest?: Field[];

  // hovered points
  dataIdxs: Array<number | null>;
  // closest/hovered series
  seriesIdx?: number | null;
  mode?: TooltipDisplayMode;
  sortOrder?: SortOrder;

  isPinned: boolean;

  annotate?: () => void;
  maxHeight?: number;

  replaceVariables?: InterpolateFunction;
  dataLinks: LinkModel[];
  hideZeros?: boolean;
  adHocFilters?: AdHocFilterModel[];
  filterByGroupedLabels?: FilterByGroupedLabelsModel;
  canExecuteActions?: boolean;
  /** Time comparison context. Absent unless the panel has a comparison configured. */
  timeCompare?: {
    /** Per-series offset from the current period, indexed like `series.fields`. */
    diffMs?: number[];
    /** Maps a series index to the index of its comparison counterpart. */
    fieldPairs?: Map<number, number>;
    /** How the delta is colored. Defaults to `TimeCompareColorMode.Standard`. */
    colorMode?: TimeCompareColorMode;
  };
  /** When provided, renders an "Add to Assistant" button in the pinned tooltip footer. */
  assistantContext?: AssistantTooltipContext;
}

export const TimeSeriesTooltip = ({
  series,
  _rest,
  dataIdxs,
  seriesIdx,
  mode = TooltipDisplayMode.Single,
  sortOrder = SortOrder.None,
  isPinned,
  annotate,
  maxHeight,
  replaceVariables = (str) => str,
  dataLinks,
  hideZeros,
  adHocFilters,
  canExecuteActions,
  filterByGroupedLabels,
  assistantContext,
  timeCompare,
}: TimeSeriesTooltipProps) => {
  const pluginContext = usePluginContext();

  const { diffMs: compareDiffMs, fieldPairs: comparisonFieldPairs, colorMode: deltaColorMode } = timeCompare ?? {};

  const xField = series.fields[0];
  let xVal = xField.values[dataIdxs[0]!];

  if (compareDiffMs != null && xField.type === FieldType.time) {
    xVal += compareDiffMs[seriesIdx ?? 1];
  }

  const xDisp = formattedValueToString(xField.display!(xVal));

  const compareFieldIdx = seriesIdx == null ? undefined : comparisonFieldPairs?.get(seriesIdx);

  // Single mode shows only the hovered series, so a pair has to borrow Multi to fit both rows and
  // then filter Multi back down to just those two.
  const isPairOnly = compareFieldIdx !== undefined && mode === TooltipDisplayMode.Single;

  const contentItems = getFieldDisplayItems(
    series.fields,
    xField,
    dataIdxs,
    seriesIdx,
    isPairOnly ? TooltipDisplayMode.Multi : mode,
    sortOrder,
    (field, i) => {
      if (field.type !== FieldType.number && field.type !== FieldType.enum) {
        return false;
      }
      return !isPairOnly || i === seriesIdx || i === compareFieldIdx;
    },
    hideZeros,
    _rest,
    compareFieldIdx,
    deltaColorMode
  );

  let footer: ReactNode;

  if (seriesIdx != null) {
    const field = series.fields[seriesIdx];
    const hasOneClickLink = dataLinks.some((dataLink) => dataLink.oneClick === true);

    if (isPinned || hasOneClickLink) {
      const visualizationType = pluginContext?.meta?.id ?? 'timeseries';
      const dataIdx = dataIdxs[seriesIdx]!;
      const actions = canExecuteActions
        ? getFieldActions(series, field, replaceVariables, dataIdx, visualizationType)
        : [];

      footer = (
        <VizTooltipFooter
          dataLinks={dataLinks}
          actions={actions}
          annotate={annotate}
          adHocFilters={adHocFilters}
          filterByGroupedLabels={filterByGroupedLabels}
          additionalContent={
            isPinned && assistantContext != null ? (
              <AssistantTooltipButton
                series={series}
                seriesIdx={seriesIdx}
                dataIdxs={dataIdxs}
                replaceVariables={replaceVariables}
                context={assistantContext}
                xVal={xVal}
              />
            ) : undefined
          }
        />
      );
    }
  }

  const headerItem: VizTooltipItem = {
    label: xField.type === FieldType.time ? '' : (xField.state?.displayName ?? xField.name),
    value: xDisp,
  };

  return (
    <VizTooltipWrapper>
      {headerItem != null && <VizTooltipHeader item={headerItem} isPinned={isPinned} />}
      <VizTooltipContent
        items={contentItems}
        isPinned={isPinned}
        scrollable={isTooltipScrollable({ mode, maxHeight })}
        maxHeight={maxHeight}
      />
      {footer}
    </VizTooltipWrapper>
  );
};
