/**
 * A library containing the different design components of the Grafana ecosystem.
 *
 * @packageDocumentation
 */

import { FormField } from './components/FormField/FormField';
import { Input, LegacyInputStatus } from './components/Forms/Legacy/Input/Input';
import { IndicatorsContainer } from './components/Forms/Legacy/Select/IndicatorsContainer';
import { NoOptionsMessage } from './components/Forms/Legacy/Select/NoOptionsMessage';
import { AsyncSelect, Select } from './components/Forms/Legacy/Select/Select';
import { Switch } from './components/Forms/Legacy/Switch/Switch';
import { SecretFormField } from './components/SecretFormField/SecretFormField';
import * as commonOptionsBuilder from './options/builder';
import * as styleMixins from './themes/mixins';
import * as DOMUtil from './utils/dom';
import * as ReactUtils from './utils/reactUtils';

export { Icon } from './components/Icon/Icon';
export { IconButton, type IconButtonVariant } from './components/IconButton/IconButton';
export { ConfirmButton } from './components/ConfirmButton/ConfirmButton';
export { DeleteButton } from './components/ConfirmButton/DeleteButton';
export { Tooltip } from './components/Tooltip/Tooltip';
export type { PopoverContent } from './components/Tooltip/types';
export { PopoverController } from './components/Tooltip/PopoverController';
export { Popover } from './components/Tooltip/Popover';
export { Toggletip } from './components/Toggletip/Toggletip';
export { Portal, getPortalContainer, PortalContainer } from './components/Portal/Portal';
export { CustomScrollbar, type ScrollbarPosition } from './components/CustomScrollbar/CustomScrollbar';
export { TabbedContainer, type TabConfig } from './components/TabbedContainer/TabbedContainer';
export { ClipboardButton } from './components/ClipboardButton/ClipboardButton';
export { Cascader, type CascaderOption } from './components/Cascader/Cascader';
export { Carousel } from './components/Carousel/Carousel';
export { ButtonCascader } from './components/ButtonCascader/ButtonCascader';
export { InlineToast } from './components/InlineToast/InlineToast';
export { LoadingPlaceholder, type LoadingPlaceholderProps } from './components/LoadingPlaceholder/LoadingPlaceholder';
export { LoadingBar, type LoadingBarProps } from './components/LoadingBar/LoadingBar';
export { ColorPicker, SeriesColorPicker } from './components/ColorPicker/ColorPicker';
export { ColorPickerInput } from './components/ColorPicker/ColorPickerInput';
export {
  SeriesColorPickerPopover,
  SeriesColorPickerPopoverWithTheme,
} from './components/ColorPicker/SeriesColorPickerPopover';
export { EmptySearchResult } from './components/EmptySearchResult/EmptySearchResult';
export { EmptyState } from './components/EmptyState/EmptyState';
export { UnitPicker } from './components/UnitPicker/UnitPicker';
export { StatsPicker } from './components/StatsPicker/StatsPicker';
export { RefreshPicker, defaultIntervals } from './components/RefreshPicker/RefreshPicker';
export { TimeRangePicker, type TimeRangePickerProps } from './components/DateTimePickers/TimeRangePicker';
export { TimeRangeProvider } from './components/DateTimePickers/TimeRangeContext';
export { TimePickerTooltip } from './components/DateTimePickers/TimeRangePicker';
export { TimeRangeLabel } from './components/DateTimePickers/TimeRangePicker/TimeRangeLabel';
export { TimeOfDayPicker } from './components/DateTimePickers/TimeOfDayPicker';
export { TimeZonePicker } from './components/DateTimePickers/TimeZonePicker';
export {
  WeekStartPicker,
  getWeekStart,
  type WeekStart,
  isWeekStart,
} from './components/DateTimePickers/WeekStartPicker';
export { DatePicker, type DatePickerProps } from './components/DateTimePickers/DatePicker/DatePicker';
export {
  DatePickerWithInput,
  type DatePickerWithInputProps,
} from './components/DateTimePickers/DatePickerWithInput/DatePickerWithInput';
export { DateTimePicker } from './components/DateTimePickers/DateTimePicker/DateTimePicker';
export { List } from './components/List/List';
export {
  InteractiveTable,
  type FetchDataArgs,
  type FetchDataFunc,
} from './components/InteractiveTable/InteractiveTable';
export { TagsInput } from './components/TagsInput/TagsInput';
export { AutoSaveField } from './components/AutoSaveField/AutoSaveField';
export { Pagination } from './components/Pagination/Pagination';
export { Tag, type OnTagClick } from './components/Tags/Tag';
export { TagList } from './components/Tags/TagList';
export { FilterPill } from './components/FilterPill/FilterPill';

export { ConfirmModal, type ConfirmModalProps } from './components/ConfirmModal/ConfirmModal';
export { QueryField, type QueryFieldProps } from './components/QueryField/QueryField';
export { CodeEditor } from './components/Monaco/CodeEditor';
export { ReactMonacoEditorLazy as ReactMonacoEditor } from './components/Monaco/ReactMonacoEditorLazy';
export {
  type Monaco,
  type monacoTypes,
  type MonacoEditor,
  type MonacoOptions as CodeEditorMonacoOptions,
  type CodeEditorSuggestionItem,
  CodeEditorSuggestionItemKind,
} from './components/Monaco/types';
export { variableSuggestionToCodeEditorSuggestion } from './components/Monaco/utils';

// TODO: namespace
export { Modal, type Props as ModalProps } from './components/Modal/Modal';
export { ModalHeader } from './components/Modal/ModalHeader';
export { ModalTabsHeader } from './components/Modal/ModalTabsHeader';
export { ModalTabContent } from './components/Modal/ModalTabContent';
export { ModalsProvider, ModalRoot, ModalsController, ModalsContext } from './components/Modal/ModalsContext';
export { PageToolbar } from './components/PageLayout/PageToolbar';

// Renderless
export { SetInterval } from './components/SetInterval/SetInterval';
export { Table } from './components/Table/Table';
export { TableCellInspector, TableCellInspectorMode } from './components/Table/TableCellInspector';
export {
  type TableCustomCellOptions,
  type CustomCellRendererProps,
  type TableFieldOptions,
  type TableSortByFieldState,
  type TableFooterCalc,
  type AdHocFilterItem,
  type TableAutoCellOptions,
  type TableSparklineCellOptions,
  type TableBarGaugeCellOptions,
  type TableColoredBackgroundCellOptions,
  type TableColorTextCellOptions,
  type TableImageCellOptions,
  type TableJsonViewCellOptions,
} from './components/Table/types';

export { TableInputCSV } from './components/TableInputCSV/TableInputCSV';
export { TabsBar } from './components/Tabs/TabsBar';
export { Tab, type TabProps } from './components/Tabs/Tab';
export { VerticalTab } from './components/Tabs/VerticalTab';
export { TabContent } from './components/Tabs/TabContent';
export { Counter } from './components/Tabs/Counter';
export { RenderUserContentAsHTML } from './components/RenderUserContentAsHTML/RenderUserContentAsHTML';

// Visualizations
export {
  BigValue,
  BigValueColorMode,
  BigValueGraphMode,
  BigValueJustifyMode,
  BigValueTextMode,
} from './components/BigValue/BigValue';
export { Sparkline } from './components/Sparkline/Sparkline';

export { Gauge } from './components/Gauge/Gauge';
export { BarGauge } from './components/BarGauge/BarGauge';
export {
  VizTooltip,
  VizTooltipContainer,
  SeriesTable,
  type SeriesTableProps,
  SeriesTableRow,
  type SeriesTableRowProps,
} from './components/VizTooltip';
export { VizRepeater, type VizRepeaterRenderValueProps } from './components/VizRepeater/VizRepeater';
export {
  PanelChrome,
  type PanelChromeProps,
  type PanelPadding,
  type PanelChromeType,
  PanelChromeLoadingIndicator,
  type PanelChromeLoadingIndicatorProps,
  PanelContextProvider,
  type PanelContext,
  PanelContextRoot,
  usePanelContext,
} from './components/PanelChrome';
export {
  VizLayout,
  type VizLayoutComponentType,
  type VizLayoutLegendProps,
  type VizLayoutProps,
} from './components/VizLayout/VizLayout';
export { type VizLegendItem, SeriesVisibilityChangeBehavior } from './components/VizLegend/types';
export { VizLegend } from './components/VizLegend/VizLegend';
export { VizLegendListItem } from './components/VizLegend/VizLegendListItem';

export { Alert, type AlertVariant } from './components/Alert/Alert';
export { Collapse, ControlledCollapse } from './components/Collapse/Collapse';
export { CollapsableSection } from './components/Collapse/CollapsableSection';
export { DataLinkButton } from './components/DataLinks/DataLinkButton';
export { FieldLinkList } from './components/DataLinks/FieldLinkList';
// Panel editors
export { FullWidthButtonContainer } from './components/Button/FullWidthButtonContainer';
export { ClickOutsideWrapper } from './components/ClickOutsideWrapper/ClickOutsideWrapper';
export {
  type SingleStatBaseOptions,
  sharedSingleStatMigrationHandler,
  convertOldAngularValueMapping,
  sharedSingleStatPanelChangedHandler,
} from './components/SingleStatShared/SingleStatBaseOptions';
export { CallToActionCard } from './components/CallToActionCard/CallToActionCard';
export { ContextMenu, type ContextMenuProps } from './components/ContextMenu/ContextMenu';
export { Menu, type MenuProps } from './components/Menu/Menu';
export { MenuGroup, type MenuItemsGroup, type MenuGroupProps } from './components/Menu/MenuGroup';
export { MenuItem, type MenuItemProps } from './components/Menu/MenuItem';
export { WithContextMenu } from './components/ContextMenu/WithContextMenu';
export { DataLinksInlineEditor } from './components/DataLinks/DataLinksInlineEditor/DataLinksInlineEditor';
export {
  DataLinksInlineEditorBase,
  type DataLinksInlineEditorBaseProps,
} from './components/DataLinks/DataLinksInlineEditor/DataLinksInlineEditorBase';
export { DataLinkInput } from './components/DataLinks/DataLinkInput';
export {
  DataLinksContextMenu,
  type DataLinksContextMenuProps,
  type DataLinksContextMenuApi,
} from './components/DataLinks/DataLinksContextMenu';
export { SeriesIcon } from './components/VizLegend/SeriesIcon';
export { InfoBox } from './components/InfoBox/InfoBox';
export { FeatureInfoBox } from './components/InfoBox/FeatureInfoBox';
export { FeatureBadge } from './components/FeatureBadge/FeatureBadge';

export { JSONFormatter } from './components/JSONFormatter/JSONFormatter';
export { JsonExplorer } from './components/JSONFormatter/json_explorer/json_explorer';
export {
  ErrorBoundary,
  ErrorBoundaryAlert,
  type ErrorBoundaryAlertProps,
  withErrorBoundary,
} from './components/ErrorBoundary/ErrorBoundary';
export { ErrorWithStack } from './components/ErrorBoundary/ErrorWithStack';
export { DataSourceHttpSettings } from './components/DataSourceSettings/DataSourceHttpSettings';
export { CustomHeadersSettings } from './components/DataSourceSettings/CustomHeadersSettings';
export { AlertingSettings } from './components/DataSourceSettings/AlertingSettings';
export { SecureSocksProxySettings } from './components/DataSourceSettings/SecureSocksProxySettings';
export { TLSAuthSettings } from './components/DataSourceSettings/TLSAuthSettings';
export { CertificationKey } from './components/DataSourceSettings/CertificationKey';
export { Spinner } from './components/Spinner/Spinner';
export { FadeTransition } from './components/transitions/FadeTransition';
export { SlideOutTransition } from './components/transitions/SlideOutTransition';
export { Segment } from './components/Segment/Segment';
export { SegmentAsync } from './components/Segment/SegmentAsync';
export { SegmentInput } from './components/Segment/SegmentInput';
export { SegmentSelect } from './components/Segment/SegmentSelect';
export { SegmentSection } from './components/Segment/SegmentSection';
export { Drawer } from './components/Drawer/Drawer';
export { Slider } from './components/Slider/Slider';
export { RangeSlider } from './components/Slider/RangeSlider';

// Next-gen forms
export { Form } from './components/Forms/Form';
export { sharedInputStyle } from './components/Forms/commonStyles';
export { InputControl } from './components/InputControl';
export {
  Button,
  LinkButton,
  type ButtonVariant,
  type ButtonProps,
  clearButtonStyles,
} from './components/Button/Button';
export { ButtonGroup } from './components/Button/ButtonGroup';
export { ToolbarButton } from './components/ToolbarButton/ToolbarButton';
export { ToolbarButtonRow } from './components/ToolbarButton/ToolbarButtonRow';
export { ValuePicker } from './components/ValuePicker/ValuePicker';
export { fieldMatchersUI } from './components/MatchersUI/fieldMatchersUI';
export { Link } from './components/Link/Link';
export { TextLink } from './components/Link/TextLink';
export { Text } from './components/Text/Text';
export { Box } from './components/Layout/Box/Box';
export { Stack } from './components/Layout/Stack/Stack';
export { Grid } from './components/Layout/Grid/Grid';
export { Space } from './components/Layout/Space';
export { ScrollContainer } from './components/ScrollContainer/ScrollContainer';

export { Label } from './components/Forms/Label';
export { Field, type FieldProps } from './components/Forms/Field';
export { Legend } from './components/Forms/Legend';
export { FieldSet } from './components/Forms/FieldSet';
export { FieldValidationMessage } from './components/Forms/FieldValidationMessage';
export { InlineField } from './components/Forms/InlineField';
export { InlineSegmentGroup } from './components/Forms/InlineSegmentGroup';
export { InlineLabel } from './components/Forms/InlineLabel';
export { InlineFieldRow } from './components/Forms/InlineFieldRow';
export { FieldArray } from './components/Forms/FieldArray';

// Select
// Note - Select is nearly deprecated in favor of Combobox
export { default as resetSelectStyles } from './components/Select/resetSelectStyles';
export * from './components/Select/Select';
export { SelectMenuOptions } from './components/Select/SelectMenu';
export { getSelectStyles } from './components/Select/getSelectStyles';
export * from './components/Select/types';

export { Combobox } from './components/Combobox/Combobox';
export { MultiCombobox } from './components/Combobox/MultiCombobox';
export { type ComboboxOption } from './components/Combobox/types';

export { HorizontalGroup, VerticalGroup, Container } from './components/Layout/Layout';
export { Badge, type BadgeColor, type BadgeProps } from './components/Badge/Badge';
export { RadioButtonGroup } from './components/Forms/RadioButtonGroup/RadioButtonGroup';
export { RadioButtonDot } from './components/Forms/RadioButtonList/RadioButtonDot';
export { RadioButtonList } from './components/Forms/RadioButtonList/RadioButtonList';

export { Input, getInputStyles } from './components/Input/Input';
export { AutoSizeInput } from './components/Input/AutoSizeInput';
export { FilterInput } from './components/FilterInput/FilterInput';
export type { FormInputSize } from './components/Forms/types';
export * from './components/SecretInput';
export * from './components/SecretTextArea';

export { Switch, InlineSwitch } from './components/Switch/Switch';
export { Checkbox } from './components/Forms/Checkbox';

export { TextArea } from './components/TextArea/TextArea';
export { FileUpload } from './components/FileUpload/FileUpload';
export {
  FileDropzone,
  FileDropzoneDefaultChildren,
  type FileDropzoneProps,
  type DropzoneFile,
} from './components/FileDropzone/FileDropzone';
export { FileListItem, type FileListItemProps } from './components/FileDropzone/FileListItem';
export { TimeRangeInput } from './components/DateTimePickers/TimeRangeInput';
export { RelativeTimeRangePicker } from './components/DateTimePickers/RelativeTimeRangePicker/RelativeTimeRangePicker';
export { Card, type Props as CardProps, getCardStyles } from './components/Card/Card';
export { CardContainer, type CardContainerProps } from './components/Card/CardContainer';
export { FormattedValueDisplay } from './components/FormattedValueDisplay/FormattedValueDisplay';
export { ButtonSelect } from './components/Dropdown/ButtonSelect';
export { Dropdown } from './components/Dropdown/Dropdown';
export {
  PluginSignatureBadge,
  type PluginSignatureBadgeProps,
} from './components/PluginSignatureBadge/PluginSignatureBadge';
export { UserIcon, type UserIconProps } from './components/UsersIndicator/UserIcon';
export { UsersIndicator, type UsersIndicatorProps } from './components/UsersIndicator/UsersIndicator';
export { type UserView } from './components/UsersIndicator/types';
export { Avatar } from './components/UsersIndicator/Avatar';
// Export this until we've figured out a good approach to inline form styles.
export { InlineFormLabel } from './components/FormLabel/FormLabel';
export { Divider } from './components/Divider/Divider';
export { getDragStyles, type DragHandlePosition } from './components/DragHandle/DragHandle';
export { useSplitter } from './components/Splitter/useSplitter';

/** @deprecated Please use non-legacy versions of these components */
const LegacyForms = {
  SecretFormField,
  FormField,
  Select,
  AsyncSelect,
  IndicatorsContainer,
  NoOptionsMessage,
  Input,
  Switch,
};
export { LegacyForms, LegacyInputStatus };

// WIP, need renames and exports cleanup
export { graphFieldOptions, getGraphFieldOptions } from './components/uPlot/config';
export { UPlotConfigBuilder } from './components/uPlot/config/UPlotConfigBuilder';
export { UPLOT_AXIS_FONT_SIZE } from './components/uPlot/config/UPlotAxisBuilder';
export { UPlotChart } from './components/uPlot/Plot';
export { PlotLegend } from './components/uPlot/PlotLegend';
export { XYCanvas } from './components/uPlot/geometries/XYCanvas';
export { Marker } from './components/uPlot/geometries/Marker';
export { EventsCanvas } from './components/uPlot/geometries/EventsCanvas';
export { TooltipPlugin2 } from './components/uPlot/plugins/TooltipPlugin2';
export { EventBusPlugin } from './components/uPlot/plugins/EventBusPlugin';
export { KeyboardPlugin } from './components/uPlot/plugins/KeyboardPlugin';

export { type PlotTooltipInterpolator, type PlotSelection, FIXED_UNIT } from './components/uPlot/types';
export { type UPlotConfigPrepFn } from './components/uPlot/config/UPlotConfigBuilder';
export * from './components/PanelChrome/types';
export { Label as BrowserLabel } from './components/BrowserLabel/Label';
export { PanelContainer } from './components/PanelContainer/PanelContainer';
export { VariablesInputModal } from './components/Actions/VariablesInputModal';

// -----------------------------------------------------
// Graveyard: exported, but no longer used internally
// These will be removed in the future
// -----------------------------------------------------

export { Graph } from './graveyard/Graph/Graph';
export { GraphWithLegend } from './graveyard/Graph/GraphWithLegend';
export { GraphContextMenu, GraphContextMenuHeader } from './graveyard/Graph/GraphContextMenu';
export { graphTimeFormat, graphTickFormatter } from './graveyard/Graph/utils';
export { GraphSeriesToggler, type GraphSeriesTogglerAPI } from './graveyard/Graph/GraphSeriesToggler';

export { GraphNG, type GraphNGProps } from './graveyard/GraphNG/GraphNG';
export { TimeSeries } from './graveyard/TimeSeries/TimeSeries';
export { useGraphNGContext } from './graveyard/GraphNG/hooks';
export { preparePlotFrame, buildScaleKey } from './graveyard/GraphNG/utils';
export { type GraphNGLegendEvent } from './graveyard/GraphNG/types';

export { ZoomPlugin } from './graveyard/uPlot/plugins/ZoomPlugin';
export { TooltipPlugin } from './graveyard/uPlot/plugins/TooltipPlugin';

export {
  ElementSelectionContext,
  useElementSelection,
  type ElementSelectionContextState,
  type ElementSelectionContextItem,
  type ElementSelectionOnSelectOptions,
  type UseElementSelectionResult,
} from './components/ElementSelectionContext/ElementSelectionContext';

export type { Themeable, Themeable2 } from './types/theme';
export type { ValidationRule, ValidationEvents } from './types/input';
export type {
  SearchFunction,
  CompletionItemGroup,
  HighlightPart,
  CompletionItem,
  TypeaheadOutput,
  TypeaheadInput,
  SuggestionsState,
} from './types/completion';
export { CompletionItemKind } from './types/completion';
export type { FormsOnSubmit, FormFieldErrors, FormAPI, FieldArrayApi } from './types/forms';
export type { IconName, IconType, IconSize } from './types/icon';
export { toIconName, isIconSize, getAvailableIcons, getFieldTypeIcon, getFieldTypeIconName } from './types/icon';
export type { ActionMeta } from './types/select';
export type { ComponentSize } from './types/size';
export type { Column } from './types/interactiveTable';
export type { CellProps, SortByFn } from 'react-table';

export {
  DEFAULT_ANNOTATION_COLOR,
  OK_COLOR,
  ALERTING_COLOR,
  NO_DATA_COLOR,
  PENDING_COLOR,
  REGION_FILL_ALPHA,
  colors,
  getTextColorForBackground,
  getTextColorForAlphaBackground,
  sortedColors,
} from './utils/colors';
export { EventsWithValidation, validate, hasValidationEvent, regexValidation } from './utils/validate';
export { SCHEMA, makeFragment, makeValue } from './utils/slate';
export { linkModelToContextMenuItems } from './utils/dataLinks';
export { getTagColorIndexFromName, getTagColorsFromName, getTagColor } from './utils/tags';
export { getScrollbarWidth } from './utils/scrollbar';
export { getCellLinks } from './utils/table';
export { getCanvasContext, measureText, calculateFontSize } from './utils/measureText';
export { createPointerDistance, usePointerDistance } from './utils/usePointerDistance';
export { useForceUpdate } from './utils/useForceUpdate';
export { SearchFunctionType } from './utils/searchFunctions';
export { createLogger } from './utils/logger';
export { attachDebugger } from './utils/debug';
export { NodeGraphDataFrameFieldNames } from './utils/nodeGraph';
export { fuzzyMatch } from './utils/fuzzy';
export { logOptions } from './utils/logOptions';

export { DOMUtil, ReactUtils };

export { ThemeContext } from '@grafana/data';
export {
  withTheme,
  withTheme2,
  useTheme,
  useTheme2,
  useStyles,
  useStyles2,
  mockThemeContext,
} from './themes/ThemeContext';
export { getTheme, mockTheme } from './themes/getTheme';
export { stylesFactory } from './themes/stylesFactory';
export { GlobalStyles } from './themes/GlobalStyles/GlobalStyles';

export { styleMixins, commonOptionsBuilder };

export { BracesPlugin } from './slate-plugins/braces';
export { ClearPlugin } from './slate-plugins/clear';
export { ClipboardPlugin } from './slate-plugins/clipboard';
export { IndentationPlugin } from './slate-plugins/indentation';
export { NewlinePlugin } from './slate-plugins/newline';
export { RunnerPlugin } from './slate-plugins/runner';
export { SelectionShortcutsPlugin } from './slate-plugins/selection_shortcuts';
export { SlatePrism, type Token } from './slate-plugins/slate-prism';
export { SuggestionsPlugin } from './slate-plugins/suggestions';

// @deprecated import from @grafana/schema
export {
  // Styles that changed
  GraphDrawStyle as DrawStyle,
  // All exports
  AxisPlacement,
  VisibilityMode as PointVisibility,
  LineInterpolation,
  ScaleDistribution,
  GraphGradientMode,
  BarGaugeDisplayMode,
  type LineStyle,
  type PointsConfig,
  type ScaleDistributionConfig,
  type HideSeriesConfig,
  BarAlignment,
  VisibilityMode as BarValueVisibility,
  ScaleOrientation,
  ScaleDirection,
  type LineConfig,
  type BarConfig,
  type FillConfig,
  type AxisConfig,
  type HideableFieldConfig,
  StackingMode,
  type StackingConfig,
  type StackableFieldConfig,
  GraphThresholdsStyleMode,
  type GraphThresholdsStyleConfig,
  type GraphFieldConfig,
  type LegendPlacement,
  LegendDisplayMode,
  type VizLegendOptions,
  type OptionsWithLegend,
  TableCellDisplayMode,
  type FieldTextAlignment,
  type VizTextDisplayOptions,
  type OptionsWithTextFormatting,
  TooltipDisplayMode,
  type VizTooltipOptions,
  type OptionsWithTooltip,
} from '@grafana/schema';
