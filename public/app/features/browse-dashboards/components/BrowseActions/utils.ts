export function buildBreakdownString(
  folderCount: number,
  dashboardCount: number,
  libraryPanelCount: number,
  alertRuleCount: number
) {
  const total = folderCount + dashboardCount + libraryPanelCount + alertRuleCount;
  const parts = [];
  if (folderCount) {
    parts.push(`${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}`);
  }
  if (dashboardCount) {
    parts.push(`${dashboardCount} ${dashboardCount === 1 ? 'dashboard' : 'dashboards'}`);
  }
  if (libraryPanelCount) {
    parts.push(`${libraryPanelCount} ${libraryPanelCount === 1 ? 'library panel' : 'library panels'}`);
  }
  if (alertRuleCount) {
    parts.push(`${alertRuleCount} ${alertRuleCount === 1 ? 'alert rule' : 'alert rules'}`);
  }
  let breakdownString = `${total} ${total === 1 ? 'item' : 'items'}`;
  if (parts.length > 0) {
    breakdownString += `: ${parts.join(', ')}`;
  }
  return breakdownString;
}
