import { Pages } from '../pages';
import { Flows } from './index';
import { Url } from '../support/url';
import { e2e } from '../index';

export const addDashboard = async (): Promise<{ dashboardTitle: string; uid: string }> => {
  Pages.AddDashboard.visit();

  const dashboardTitle = Flows.saveNewDashboard();

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
