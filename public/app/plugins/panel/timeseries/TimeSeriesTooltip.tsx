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
  comparisonPairingMap?: Map<number, number>;
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
  filterByGroupedLabels,
  assistantContext,
  comparisonPairingMap = new Map(),
}: TimeSeriesTooltipProps) => {
  const pluginContext = usePluginContext();

  const xField = series.fields[0];
  let xVal = xField.values[dataIdxs[0]!];

  if (compareDiffMs != null && xField.type === FieldType.time) {
    xVal += compareDiffMs[seriesIdx ?? 1];
  }

  const xDisp = formattedValueToString(xField.display!(xVal));

  let compareFieldIdx: number | undefined = undefined;
  if (seriesIdx !== null && seriesIdx !== undefined) {
    const hoveredFrameIdx = series.fields[seriesIdx].state?.origin?.frameIndex;
    const hoveredFieldIdx = series.fields[seriesIdx].state?.origin?.fieldIndex;
    if (hoveredFrameIdx !== undefined) {
      // comparisonPairingMap is always compareIdx, origIdx
      const origIdx = comparisonPairingMap.get(hoveredFrameIdx);
      if (origIdx !== undefined) {
        const origFrameIdx = series.fields.findIndex(
          (field) => field.state?.origin?.frameIndex === origIdx && field.state.origin.fieldIndex === hoveredFieldIdx
        );
        compareFieldIdx = origFrameIdx;
        console.log('found orig from comp', hoveredFrameIdx, origFrameIdx);
      } else {
        const compIdx = [...comparisonPairingMap].find(([_, value]) => value === hoveredFrameIdx)?.[0];
        const compFrameIdx = series.fields.findIndex((field, i) => field.state?.origin?.frameIndex === compIdx);
        console.log('found comp from orig', hoveredFrameIdx, compFrameIdx);
        compareFieldIdx = compFrameIdx;
      }
    }
  }

  // if there is no compare, use mode.
  // if there is a compare but mode is set to not multi, use mode.
  // if there is a compare and mode is set to single, use multi to show compare field
  const modeWithCompare =
    compareFieldIdx === undefined || mode !== TooltipDisplayMode.Single ? mode : TooltipDisplayMode.Multi;

  const contentItems = getFieldDisplayItems(
    series.fields,
    xField,
    dataIdxs,
    seriesIdx,
    modeWithCompare,
    sortOrder,
    (field, i) => {
      if (compareFieldIdx === undefined) {
        return field.type === FieldType.number || field.type === FieldType.enum;
      } else {
        return (
          field.state?.displayName === series.fields[compareFieldIdx].state?.displayName ||
          (i !== undefined && field.state?.displayName === series.fields[i].state?.displayName)
        );
      }
    },
    hideZeros,
    _rest
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
