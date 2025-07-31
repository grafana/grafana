/**
 * This file is used to share internal grafana/ui code with Grafana core.
 * Note that these exports are also used within Enterprise.
 *
 * Through the exports declared in package.json we can import this code in core Grafana and the grafana/ui
 * package will continue to be able to access all code when it's published to npm as it's private to the package.
 *
 * During the yarn pack lifecycle the exports[./internal] property is deleted from the package.json
 * preventing the code from being importable by plugins or other npm packages making it truly "internal".
 *
 */

export { UPlotChart } from '../components/uPlot/Plot';
export { type AxisProps, UPLOT_AXIS_FONT_SIZE, timeUnitSize } from '../components/uPlot/config/UPlotAxisBuilder';
export {
  type Renderers,
  UPlotConfigBuilder,
  type UPlotConfigPrepFn,
} from '../components/uPlot/config/UPlotConfigBuilder';
export { type ScaleProps } from '../components/uPlot/config/UPlotScaleBuilder';
export {
  pluginLog,
  preparePlotData2,
  getStackingGroups,
  getDisplayValuesForCalcs,
  type StackingGroup,
} from '../components/uPlot/utils';
export { hasVisibleLegendSeries, PlotLegend } from '../components/uPlot/PlotLegend';
export { getScaleGradientFn } from '../components/uPlot/config/gradientFills';
export { buildScaleKey } from '../components/uPlot/internal';
export { CloseButton } from '../components/uPlot/plugins/CloseButton';
export { type TimeRange2, TooltipHoverMode } from '../components/uPlot/plugins/TooltipPlugin2';
export type { FacetedData, FacetSeries } from '../components/uPlot/types';

export { getResponsiveStyle, type ResponsiveProp } from '../components/Layout/utils/responsiveness';
export { ColorSwatch } from '../components/ColorPicker/ColorSwatch';

export { FieldNamePicker } from '../components/MatchersUI/FieldNamePicker';
export { comparisonOperationOptions } from '../components/MatchersUI/FieldValueMatcher';
export {
  frameHasName,
  getFrameFieldsDisplayNames,
  useFieldDisplayNames,
  useSelectOptions,
} from '../components/MatchersUI/utils';
export type { FieldMatcherUIRegistryItem } from '../components/MatchersUI/types';
export { RefIDMultiPicker, RefIDPicker, stringsToRegexp } from '../components/MatchersUI/FieldsByFrameRefIdMatcher';
export { getAllFieldTypeIconOptions } from '../components/MatchersUI/FieldTypeMatcherEditor';

export { getStyles as getSliderStyles } from '../components/Slider/styles';
export { getSelectStyles } from '../components/Select/getSelectStyles';
export type { Props as InputProps } from '../components/Input/Input';
export type { ModalsContextState } from '../components/Modal/ModalsContext';
export { getModalStyles } from '../components/Modal/getModalStyles';
export { MultiValueRemove, type MultiValueRemoveProps } from '../components/Select/MultiValue';
export { getSvgSize } from '../components/Icon/utils';
export { LoadingIndicator } from '../components/PanelChrome/LoadingIndicator';
export { type ButtonLinkProps, getButtonStyles } from '../components/Button/Button';
export {
  type TableSortByFieldState,
  type TableFieldOptions,
  TableCellDisplayMode,
  FILTER_FOR_OPERATOR,
  FILTER_OUT_OPERATOR,
} from '../components/Table/types';
export { defaultSparklineCellConfig } from '../components/Table/Cells/SparklineCell';
export { TableCell } from '../components/Table/Cells/TableCell';
export { useTableStyles } from '../components/Table/TableRT/styles';
export { migrateTableDisplayModeToCellOptions } from '../components/Table/utils';
export { type DataLinksContextMenuApi } from '../components/DataLinks/DataLinksContextMenu';
export { MenuDivider } from '../components/Menu/MenuDivider';
export { AbstractList } from '../components/List/AbstractList';
export type { HttpSettingsBaseProps, AzureAuthSettings } from '../components/DataSourceSettings/types';
export { TimeZoneOffset, formatUtcOffset } from '../components/DateTimePickers/TimeZonePicker/TimeZoneOffset';
export { TimeZoneTitle } from '../components/DateTimePickers/TimeZonePicker/TimeZoneTitle';
export type { CodeEditorProps } from '../components/Monaco/types';
export { type Props as InlineFieldProps } from '../components/Forms/InlineField';
export { DataLinkSuggestions } from '../components/DataLinks/DataLinkSuggestions';
export { type Props as AlertProps } from '../components/Alert/Alert';
export { type TooltipPlacement } from '../components/Tooltip/types';
export { ConfirmContent, type ConfirmContentProps } from '../components/ConfirmModal/ConfirmContent';

export { EmotionPerfTest } from '../components/ThemeDemos/EmotionPerfTest';

export { VizTooltipContent } from '../components/VizTooltip/VizTooltipContent';
export { VizTooltipFooter, type AdHocFilterModel } from '../components/VizTooltip/VizTooltipFooter';
export { VizTooltipHeader } from '../components/VizTooltip/VizTooltipHeader';
export { VizTooltipWrapper } from '../components/VizTooltip/VizTooltipWrapper';
export { VizTooltipRow } from '../components/VizTooltip/VizTooltipRow';
export { getContentItems } from '../components/VizTooltip/utils';
export { ColorIndicator, ColorPlacement, type VizTooltipItem } from '../components/VizTooltip/types';
export { mapMouseEventToMode } from '../components/VizLegend/utils';
export { Carousel } from '../components/Carousel/Carousel';

export { getFocusStyles, getMouseFocusStyles, getTooltipContainerStyles } from '../themes/mixins';

export { optsWithHideZeros } from '../options/builder/tooltip';
export { StackingEditor } from '../options/builder/stacking';
export { addHideFrom } from '../options/builder/hideSeries';
export { ScaleDistributionEditor } from '../options/builder/axis';

export { useComponentInstanceId } from '../utils/useComponetInstanceId';
export { closePopover } from '../utils/closePopover';

export { flattenTokens } from '../slate-plugins/slate-prism';
