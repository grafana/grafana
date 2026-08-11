/**
 * Dashboard Command Registry
 *
 * The commands that exist on a dashboard. DashboardMutationClient hands this to the dispatcher, which
 * iterates over it generically.
 *
 * Dashboard-only by construction: another document type has its own list, so a command is reachable
 * exactly where it is registered and nowhere else.
 */

import { addAnnotationCommand } from './addAnnotation';
import { addPanelCommand } from './addPanel';
import { addRowCommand } from './addRow';
import { addTabCommand } from './addTab';
import { addVariableCommand } from './addVariable';
import { applySpecCommand } from './applySpec';
import { enterEditModeCommand } from './enterEditMode';
import { getDashboardInfoCommand } from './getDashboardInfo';
import { getLayoutCommand } from './getLayout';
import { getSpecCommand } from './getSpec';
import { listAnnotationsCommand } from './listAnnotations';
import { listPanelsCommand } from './listPanels';
import { listVariablesCommand } from './listVariables';
import { movePanelCommand } from './movePanel';
import { moveRowCommand } from './moveRow';
import { moveTabCommand } from './moveTab';
import { removeAnnotationCommand } from './removeAnnotation';
import { removePanelCommand } from './removePanel';
import { removeRowCommand } from './removeRow';
import { removeTabCommand } from './removeTab';
import { removeVariableCommand } from './removeVariable';
import type { MutationCommand } from './types';
import { updateAnnotationCommand } from './updateAnnotation';
import { updateDashboardSettingsCommand } from './updateDashboardSettings';
import { updateLayoutCommand } from './updateLayout';
import { updatePanelCommand } from './updatePanel';
import { updateRowCommand } from './updateRow';
import { updateTabCommand } from './updateTab';
import { updateVariableCommand } from './updateVariable';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each command is typed internally; the array is heterogeneous
export const DASHBOARD_COMMANDS: Array<MutationCommand<any>> = [
  addVariableCommand,
  removeVariableCommand,
  updateVariableCommand,
  listVariablesCommand,
  addAnnotationCommand,
  updateAnnotationCommand,
  removeAnnotationCommand,
  listAnnotationsCommand,
  enterEditModeCommand,
  getLayoutCommand,
  addRowCommand,
  removeRowCommand,
  updateRowCommand,
  moveRowCommand,
  addTabCommand,
  removeTabCommand,
  updateTabCommand,
  moveTabCommand,
  movePanelCommand,
  updateLayoutCommand,
  addPanelCommand,
  updatePanelCommand,
  removePanelCommand,
  listPanelsCommand,
  getDashboardInfoCommand,
  updateDashboardSettingsCommand,
  getSpecCommand,
  applySpecCommand,
];
