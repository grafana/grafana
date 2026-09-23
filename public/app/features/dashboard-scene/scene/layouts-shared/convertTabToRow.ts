import { RowItem } from '../layout-rows/RowItem';
import { type TabItem } from '../layout-tabs/TabItem';

export function convertTabToRow(tab: TabItem): RowItem {
  const conditionalRendering = tab.state.conditionalRendering;
  conditionalRendering?.clearParent();
  // We need to clear the target since we don't want to point to the original tab anymore (if it was set)
  conditionalRendering?.setTarget(undefined);

  const layout = tab.state.layout;
  layout.clearParent();

  const $variables = tab.state.$variables;
  $variables?.clearParent();

  return new RowItem({
    layout,
    title: tab.state.title,
    conditionalRendering,
    repeatByVariable: tab.state.repeatByVariable,
    $variables,
  });
}
