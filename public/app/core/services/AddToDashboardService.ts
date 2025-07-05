import { type AddToDashboardService as AddToDashboardServiceInterface } from '@grafana/runtime';
import { ExploreToDashboardPanel } from 'app/features/explore/extensions/AddToDashboard/ExploreToDashboardPanel';

export class AddToDashboardService implements AddToDashboardServiceInterface {
  // Expose the AddToDashboardForm component here
  getExploreToDashboardPanel() {
    return ExploreToDashboardPanel;
  }
}
