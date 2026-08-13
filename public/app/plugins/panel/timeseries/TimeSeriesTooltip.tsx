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
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';
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

import { getCompareDelta } from './utils';

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
  compareDiffMs?: number[];
  /**
   * Time-comparison pairing, mapping a field index in `series` to its counterpart's field index in
   * both directions. Lets the hovered series' opposite-period value be shown alongside it.
   */
  comparePartners?: Map<number, number>;
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
  compareDiffMs,
  comparePartners,
  filterByGroupedLabels,
  assistantContext,
}: TimeSeriesTooltipProps) => {
  const pluginContext = usePluginContext();

  const xField = series.fields[0];
  let xVal = xField.values[dataIdxs[0]!];

  if (compareDiffMs != null && xField.type === FieldType.time) {
    xVal += compareDiffMs[seriesIdx ?? 1];
  }

  const xDisp = formattedValueToString(xField.display!(xVal));

  const isGraphable = (field: Field) => field.type === FieldType.number || field.type === FieldType.enum;

  let contentItems = getFieldDisplayItems(
    series.fields,
    xField,
    dataIdxs,
    seriesIdx,
    mode,
    sortOrder,
    isGraphable,
    hideZeros,
    _rest
  );

  // Single mode lists only the hovered series. When that series is part of a time-comparison pair,
  // pull in its counterpart so both periods are readable from one hover. Multi mode already lists
  // both, since they are sibling fields of the aligned frame.
  const partnerIdx =
    mode === TooltipDisplayMode.Single && seriesIdx != null ? comparePartners?.get(seriesIdx) : undefined;

  if (partnerIdx != null) {
    // No extraFields here: they are keyed off dataIdxs[0], not the series, so the first call
    // already emitted them and passing them again would duplicate every row.
    const partnerItems = getFieldDisplayItems(
      series.fields,
      xField,
      dataIdxs,
      partnerIdx,
      TooltipDisplayMode.Single,
      sortOrder,
      isGraphable,
      hideZeros
    );

    // Place the counterpart directly below the hovered row (bolded so it stays identifiable now that
    // Single mode shows two rows), ahead of any extraFields rows the first call already appended.
    const hoveredPos = contentItems.findIndex((item) => item.fieldIdx === seriesIdx);

    contentItems =
      hoveredPos === -1
        ? contentItems.concat(partnerItems)
        : [
            ...contentItems.slice(0, hoveredPos),
            { ...contentItems[hoveredPos], isActive: true },
            ...partnerItems,
            ...contentItems.slice(hoveredPos + 1),
          ];
  }

  if (compareDiffMs != null && comparePartners != null && comparePartners.size > 0) {
    contentItems = contentItems.map((item) =>
      appendCompareDelta(item, series, dataIdxs, compareDiffMs, comparePartners)
    );
  }

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

/**
 * Annotates a comparison-period row with how far it sits from its current-period counterpart, so the
 * change between the two periods is readable without the user subtracting by eye. The delta hangs off
 * the compare row rather than the current row so that the current row keeps reading as a plain value.
 * Rows that aren't the compare half of a pair, or whose pair has no value at this x, are returned as-is.
 */
function appendCompareDelta(
  item: VizTooltipItem,
  series: DataFrame,
  dataIdxs: Array<number | null>,
  compareDiffMs: number[],
  comparePartners: Map<number, number>
): VizTooltipItem {
  const compareIdx = item.fieldIdx;

  if (compareIdx == null || (compareDiffMs[compareIdx] ?? 0) === 0) {
    return item;
  }

  const currentIdx = comparePartners.get(compareIdx);

  if (currentIdx == null) {
    return item;
  }

  const compareDataIdx = dataIdxs[compareIdx];
  const currentDataIdx = dataIdxs[currentIdx];

  if (compareDataIdx == null || currentDataIdx == null) {
    return item;
  }

  const currentField = series.fields[currentIdx];
  const delta = getCompareDelta(
    currentField,
    currentField.values[currentDataIdx],
    series.fields[compareIdx].values[compareDataIdx]
  );

  if (delta == null) {
    return item;
  }

  const deltaText = delta.pct != null ? `${delta.abs}, ${delta.pct}` : delta.abs;

  return { ...item, value: `${item.value} (${deltaText})` };
}
