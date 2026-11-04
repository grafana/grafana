import { type ReviewCorpusCase } from '../types';

import { annotationsAndLinks } from './annotationsAndLinks';
import { autoGridSettings } from './autoGridSettings';
import {
  itemFitContentInherited,
  itemFitContentOverridden,
  matchRowHeightsTurnedOff,
  matchRowHeightsTurnedOn,
} from './autoGridTriState';
import { bookkeepingOnly } from './bookkeepingOnly';
import { dashboardProperties } from './dashboardProperties';
import { deepNesting } from './deepNesting';
import {
  duplicateMovedFirst,
  duplicatesRemovedWithRow,
  duplicateSystemDefaultOwner,
  duplicateUpdated,
} from './duplicateNames';
import { elementKeyWithSlash } from './elementKeyWithSlash';
import {
  descriptionCleared,
  emptyDescriptionDropped,
  emptyDescriptionDroppedInCopy,
  longDescriptionRemoved,
} from './emptyDescription';
import { fieldConfigUnit } from './fieldConfigUnit';
import { gridItemRemovedFromMiddle } from './gridItemRemovedFromMiddle';
import { libraryPanelCreated } from './libraryPanel';
import { manyPanels } from './manyPanels';
import { folderMoved, predefinedVariablesChanged } from './metadataOnly';
import { panelMovedBetweenTabs, panelMovedToFirst, panelPositionOnly, sectionsReordered } from './moves';
import { newDashboard } from './newDashboard';
import { newDashboardAutoGrid } from './newDashboardAutoGrid';
import { noChanges } from './noChanges';
import { overridesAddedAndChanged } from './overridesAddedAndChanged';
import { overviewMixed } from './overviewMixed';
import { panelAdded } from './panelAdded';
import { panelMovedBetweenRows } from './panelMovedBetweenRows';
import { panelPositionAndSize } from './panelPositionAndSize';
import { panelRemoved } from './panelRemoved';
import { panelRenamed } from './panelRenamed';
import { pendingChangesBaseline } from './pendingChangesBaseline';
import { pluginOptionChanged, pluginOptionChangedWithoutPlugin } from './pluginOptionChanged';
import { pluginVersionsBumped } from './pluginVersionsBumped';
import { prototypeElementNames } from './prototypeElementNames';
import { queryAppended } from './queryAppended';
import { queryExpressionChanged } from './queryExpressionChanged';
import { queryInsertedBeforeA } from './queryInsertedBeforeA';
import { queryOptionsChanged } from './queryOptionsChanged';
import { rowAdded } from './rowAdded';
import { rowRemovedWithPanels } from './rowRemovedWithPanels';
import { rowRenamed } from './rowRenamed';
import { rowSettings } from './rowSettings';
import { rowsToTabs } from './rowsToTabs';
import { saveAsCopy } from './saveAsCopy';
import { sectionVariables } from './sectionVariables';
import {
  panelRuleSetAddedWithLayoutChange,
  ruleSetAddedToTab,
  ruleSetRemovedFromTab,
  singleRuleVisibilityChanged,
  timeRangeRuleChanged,
  variableRulesAddedRemovedChanged,
  visibilityAndMatchChanged,
} from './showHideRules';
import {
  optionAddedWithNonDefaultValue,
  optionAddedWithoutPlugin,
  optionChangedToDefault,
  pluginOptionDefaultFilledIn,
  pluginVersionFilledIn,
} from './systemDefaults';
import { systemDefaultsEmptyValues } from './systemDefaultsEmptyValues';
import { fieldConfigTextValue, fieldConfigTextValueWithoutPlugin } from './textValues';
import { thresholdsChanged, thresholdsModeChanged } from './thresholdsChanged';
import { timeRangeAndRefresh } from './timeRangeAndRefresh';
import { transformationAdded } from './transformationAdded';
import { transparentTurnedOn } from './transparentTurnedOn';
import { unconfiguredToGauge, unconfiguredToGaugeWithoutPlugin } from './unconfiguredToGauge';
import { unknownLayoutKind } from './unknownLayoutKind';
import { untitledAndDuplicatePanels } from './untitledAndDuplicatePanels';
import { untitledAndDuplicateSections } from './untitledAndDuplicateSections';
import { variablesByName } from './variablesByName';
import { visualizationChanged } from './visualizationChanged';

/** Every corpus case, in the order the runner reports them. */
export const corpusCases: ReviewCorpusCase[] = [
  // No changes, and dashboard-level edits
  noChanges,
  bookkeepingOnly,
  dashboardProperties,
  timeRangeAndRefresh,
  variablesByName,
  annotationsAndLinks,
  autoGridSettings,
  // Panel edits
  panelRenamed,
  queryAppended,
  queryInsertedBeforeA,
  queryExpressionChanged,
  transformationAdded,
  queryOptionsChanged,
  visualizationChanged,
  unconfiguredToGauge,
  unconfiguredToGaugeWithoutPlugin,
  pluginOptionChanged,
  pluginOptionChangedWithoutPlugin,
  fieldConfigUnit,
  fieldConfigTextValue,
  fieldConfigTextValueWithoutPlugin,
  thresholdsChanged,
  thresholdsModeChanged,
  overridesAddedAndChanged,
  transparentTurnedOn,
  libraryPanelCreated,
  // Panels added, removed and moved
  panelAdded,
  panelRemoved,
  gridItemRemovedFromMiddle,
  panelMovedBetweenRows,
  panelMovedBetweenTabs,
  panelPositionAndSize,
  panelPositionOnly,
  panelMovedToFirst,
  // Sections
  rowRenamed,
  rowRemovedWithPanels,
  rowAdded,
  rowSettings,
  sectionVariables,
  rowsToTabs,
  sectionsReordered,
  deepNesting,
  untitledAndDuplicatePanels,
  untitledAndDuplicateSections,
  duplicateMovedFirst,
  duplicateUpdated,
  duplicateSystemDefaultOwner,
  duplicatesRemovedWithRow,
  overviewMixed,
  // Show/hide rules
  timeRangeRuleChanged,
  singleRuleVisibilityChanged,
  panelRuleSetAddedWithLayoutChange,
  visibilityAndMatchChanged,
  variableRulesAddedRemovedChanged,
  ruleSetAddedToTab,
  ruleSetRemovedFromTab,
  // System defaults
  pluginVersionFilledIn,
  pluginVersionsBumped,
  pluginOptionDefaultFilledIn,
  systemDefaultsEmptyValues,
  optionAddedWithoutPlugin,
  optionChangedToDefault,
  optionAddedWithNonDefaultValue,
  // Save flows
  newDashboard,
  saveAsCopy,
  folderMoved,
  predefinedVariablesChanged,
  manyPanels,
  pendingChangesBaseline,
  elementKeyWithSlash,
  // Regressions from code review
  matchRowHeightsTurnedOff,
  matchRowHeightsTurnedOn,
  itemFitContentOverridden,
  itemFitContentInherited,
  newDashboardAutoGrid,
  emptyDescriptionDropped,
  emptyDescriptionDroppedInCopy,
  descriptionCleared,
  longDescriptionRemoved,
  prototypeElementNames,
  unknownLayoutKind,
];
