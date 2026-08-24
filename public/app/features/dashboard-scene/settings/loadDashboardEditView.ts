export async function loadDashboardEditView(editview: string) {
  const { createDashboardEditViewFor } = await import(
    /* webpackChunkName: "dashboard-settings" */ './createDashboardEditViewFor'
  );

  return createDashboardEditViewFor(editview);
}
