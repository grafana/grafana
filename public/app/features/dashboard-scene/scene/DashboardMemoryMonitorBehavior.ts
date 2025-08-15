import { config } from '@grafana/runtime';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { createLogger } from '@grafana/ui';

import { getDashboardMemoryMonitor } from '../../dashboard/services/DashboardMemoryMonitor';

export interface DashboardMemoryMonitorBehaviorState extends SceneObjectState {
  enabled: boolean;
}

/**
 * Behavior that manages dashboard memory monitoring for a specific dashboard scene
 * Automatically starts/stops monitoring based on scene lifecycle
 */
export class DashboardMemoryMonitorBehavior extends SceneObjectBase<DashboardMemoryMonitorBehaviorState> {
  private dashboardUid?: string;
  private logger = createLogger('DashboardMemoryMonitorBehavior', 'grafana.debug.memory');

  constructor(state: DashboardMemoryMonitorBehaviorState) {
    super(state);
  }

  /**
   * Called when the scene is activated (dashboard loads)
   */
  public activate() {
    const deactivationHandler = super.activate();

    if (!this.state.enabled) {
      return deactivationHandler;
    }

    // Get dashboard UID from scene context
    this.dashboardUid = this.getDashboardUid();

    this.logger.logger('activate', false, 'called. Enabled:', this.state.enabled, 'DashboardUid:', this.dashboardUid);

    if (this.dashboardUid) {
      const memoryMonitor = getDashboardMemoryMonitor();
      memoryMonitor.startMonitoring({ dashboardUid: this.dashboardUid });
    } else {
      this.logger.logger('activate', false, 'No dashboard UID found, skipping monitoring');
    }

    // Return a function that will be called when the scene is deactivated
    return () => {
      if (this.dashboardUid) {
        const memoryMonitor = getDashboardMemoryMonitor();
        memoryMonitor.stopMonitoring();
        this.dashboardUid = undefined;
      }

      // Call the original deactivation handler
      if (deactivationHandler) {
        deactivationHandler();
      }
    };
  }

  /**
   * Get dashboard UID from the scene context
   */
  private getDashboardUid(): string | undefined {
    // Since this behavior is always attached to DashboardScene, we can directly access its uid
    // DashboardScene has uid in its state, so we can access it via parent
    if (this.parent && 'state' in this.parent && this.parent.state && 'uid' in this.parent.state) {
      const uid = this.parent.state.uid;
      return typeof uid === 'string' ? uid : undefined;
    }
    return undefined;
  }
}

/**
 * Factory function to create DashboardMemoryMonitorBehavior with proper configuration check
 */
export function createDashboardMemoryMonitorBehavior(dashboardUid: string): DashboardMemoryMonitorBehavior {
  const configuredDashboards = config.dashboardMemoryMonitoring || [];

  // Check if monitoring is enabled for this dashboard
  const enabled =
    configuredDashboards.length > 0 &&
    (configuredDashboards.includes('*') || configuredDashboards.includes(dashboardUid));

  return new DashboardMemoryMonitorBehavior({ enabled });
}
