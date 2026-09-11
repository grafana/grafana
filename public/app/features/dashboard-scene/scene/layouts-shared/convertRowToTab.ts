import { type RowItem } from '../layout-rows/RowItem';
import { TabItem } from '../layout-tabs/TabItem';

export function convertRowToTab(row: RowItem): TabItem {
  const conditionalRendering = row.state.conditionalRendering;
  conditionalRendering?.clearParent();
  // We need to clear the target since we don't want to point to the original row anymore (if it was set)
  conditionalRendering?.setTarget(undefined);

  const layout = row.state.layout;
  layout.clearParent();

  const $variables = row.state.$variables;
  $variables?.clearParent();

  return new TabItem({
    layout,
    title: row.state.title,
    conditionalRendering,
    repeatByVariable: row.state.repeatByVariable,
    $variables,
  });
}
