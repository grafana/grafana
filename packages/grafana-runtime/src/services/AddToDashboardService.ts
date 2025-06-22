import { Panel } from '@grafana/schema';
import { ComponentType } from 'react';

/**
 * Used to work with user defined addToDashboard.
 * Should be accessed via {@link getAddToDashboardService} function.
 *
 * @alpha
 */
export interface AddToDashboardService {
  /**
   * Returns a React component for the add to dashboard modal
   *
   * @returns ExploreToDashboardPanel component
   */
  getExploreToDashboardPanel: () => ComponentType<{
    onClose: () => void;
    exploreId: string;
    panel?: Panel;
  }>;
}

let singletonInstance: AddToDashboardService;

/**
 * Used during startup by Grafana to set the AddToDashboardService so it is available
 * via {@link getAddToDashboardService} to the rest of the application.
 *
 * @internal
 */
export function setAddToDashboardService(instance: AddToDashboardService) {
  singletonInstance = instance;
}

/**
 * Used to retrieve the {@link AddToDashboardService}.
 *
 * @alpha
 */
export function getAddToDashboardService(): AddToDashboardService {
  return singletonInstance;
}
