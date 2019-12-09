import { e2e } from '../index';
import { Url } from '../support/url';

export const addDashboard = async (): Promise<{ dashboardTitle: string; uid: string }> => {
  e2e.pages.AddDashboard.visit();

  const dashboardTitle = e2e.flows.saveNewDashboard();

  return new Promise(resolve => {
    e2e()
      .url()
      .then((url: string) => {
        resolve({
          dashboardTitle,
          uid: Url.getDashboardUid(url),
        });
      });
  });
};
