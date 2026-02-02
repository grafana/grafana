import { LoadingState } from '@grafana/data';
import config from 'app/core/config';
import { getBackendSrv } from 'app/core/services/backend_srv';
import { FEATURE_CONST, getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';
import { DashboardModel } from 'app/features/dashboard/state/DashboardModel';
import { PanelModel } from 'app/features/dashboard/state/PanelModel';
import { getWidgetPluginMeta } from 'app/features/panel/state/util';

type DashboardInfo = {
  id: string;
  name: string;
  panelIsInViewCount: number;
  dashboardInEdit: Boolean;
};

const POST_FRONTEND_METRICS = '/api/frontend-metrics';
const VISIBILITY_CHANGE = 'visibilitychange';

class DashboardLoadTime {
  static _instance: DashboardLoadTime;
  private loadTimeRecorded: boolean | false;
  private hitDataRecorded: boolean | false;
  private startTime: number | 0;
  private dashboardInfo: DashboardInfo;
  private dashboardPanelsRendered: number | 0;
  private dashboardPanelRenderedFailed: boolean | false;
  private skipPanels: string[];
  // open empty panels properties
  private dashboardPanelsWaitingForRefresh: number | 0;
  private variablesFinishedLoadingTime: number | 0;
  private panelsStartedLoadingTime: number | 0;
  private loadTimeBeforeTabBecomesInactive: number | 0;

  constructor() {
    this.loadTimeRecorded = false;
    this.hitDataRecorded = false;
    this.startTime = 0;
    this.loadTimeBeforeTabBecomesInactive = 0;
    this.dashboardInfo = this.extractDashboardInfo(null);
    this.dashboardPanelsRendered = 0;
    this.dashboardPanelRenderedFailed = false;
    this.skipPanels = getWidgetPluginMeta().map((p) => p.id);
    this.dashboardPanelsWaitingForRefresh = 0;
    this.variablesFinishedLoadingTime = 0;
    this.panelsStartedLoadingTime = 0;
  }

  private extractDashboardInfo(dashboard: DashboardModel | null): DashboardInfo {
    const localDashboardInfo: DashboardInfo = {
      id: dashboard?.id || '',
      name: dashboard?.title || '',
      panelIsInViewCount:
        dashboard?.panels?.filter((panel: PanelModel) => panel.isInView && !this.skipPanels.includes(panel.type))
          ?.length || 0,
      dashboardInEdit: dashboard?.panelInEdit ? true : false || false,
    };
    return localDashboardInfo;
  }

  public setDashboardInfo(dashboardInfo: any) {
    this.dashboardInfo = this.extractDashboardInfo(dashboardInfo);
  }

  public setDashboardPanelRendered(panelStatus: LoadingState) {
    if (!this.dashboardInfo.dashboardInEdit) {
      if (panelStatus === LoadingState.Done) {
        this.dashboardPanelsRendered = this.dashboardPanelsRendered + 1;
      } else if (panelStatus === LoadingState.RefreshToLoad) {
        // Blank dashboard status
        this.dashboardPanelsWaitingForRefresh = this.dashboardPanelsWaitingForRefresh + 1;
      } else if (panelStatus === LoadingState.Error) {
        // If a panel errors out, we don't send load time
        this.dashboardPanelRenderedFailed = true;
      }
      this.checkDashboardIsReady();
    }
  }

  public reset() {
    this.loadTimeRecorded = false;
    this.hitDataRecorded = false;
    this.dashboardPanelRenderedFailed = false;
    this.startTime = new Date().getTime();
    this.dashboardInfo = this.extractDashboardInfo(null);
    this.dashboardPanelsRendered = 0;
    this.loadTimeBeforeTabBecomesInactive = 0;
    this.dashboardPanelsWaitingForRefresh = 0;
    this.variablesFinishedLoadingTime = 0;
    this.panelsStartedLoadingTime = 0;
    document.addEventListener(VISIBILITY_CHANGE, this.handleVisibilityChange);
  }

  public dashboardRefreshStarted() {
    if (
      !this.loadTimeRecorded &&
      this.panelsStartedLoadingTime === 0 &&
      getFeatureStatus(FEATURE_CONST.BHD_GF_OPEN_EMPTY_PANELS)
    ) {
      this.panelsStartedLoadingTime = new Date().getTime();
    }
  }

  private checkDashboardIsReady(): void {
    if (
      !this.isPuppeteer() &&
      !this.loadTimeRecorded &&
      !this.dashboardInfo.dashboardInEdit &&
      this.dashboardInfo.id &&
      this.startTime &&
      this.dashboardInfo.panelIsInViewCount
    ) {
      if (
        getFeatureStatus(FEATURE_CONST.BHD_GF_OPEN_EMPTY_PANELS) &&
        this.dashboardPanelsWaitingForRefresh > 0 &&
        this.variablesFinishedLoadingTime === 0
      ) {
        // if atleast one panel goes into Waiting for Refresh state, we consider variables have finished loading
        this.variablesFinishedLoadingTime = new Date().getTime();
      }

      if (
        this.dashboardInfo.panelIsInViewCount === this.dashboardPanelsRendered &&
        !this.dashboardPanelRenderedFailed
      ) {
        const END_TIME = new Date().getTime();
        let loadTime = END_TIME - this.startTime + this.loadTimeBeforeTabBecomesInactive;

        // load blank dashboard stuff
        if (this.panelsStartedLoadingTime !== 0 && this.variablesFinishedLoadingTime !== 0) {
          loadTime = loadTime - (this.panelsStartedLoadingTime - this.variablesFinishedLoadingTime);
        }

        this.loadTimeRecorded = true;
        document.removeEventListener(VISIBILITY_CHANGE, this.handleVisibilityChange);

        if (loadTime >= 0) {
          getBackendSrv().post(
            POST_FRONTEND_METRICS,
            this.constructDashboardLoadTimeRequest(Math.round(loadTime / 1000), this.dashboardInfo.id),
            {
              retry: 0,
              showErrorAlert: false,
            }
          );
        }
      }
    }
  }

  public recordDashboardHit() {
    if (!this.isPuppeteer() && !this.dashboardInfo.dashboardInEdit && this.dashboardInfo.id && !this.hitDataRecorded) {
      this.hitDataRecorded = true;
      getBackendSrv().post(POST_FRONTEND_METRICS, this.constructDashboardHitRequest(this.dashboardInfo.id), {
        retry: 0,
        showErrorAlert: false,
      });
    }
  }

  private handleVisibilityChange = () => {
    if (!this.isPuppeteer() && !this.loadTimeRecorded) {
      if (document.hidden) {
        // page not in view
        const currentTime = new Date().getTime();
        if (this.variablesFinishedLoadingTime === 0) {
          this.loadTimeBeforeTabBecomesInactive = currentTime - this.startTime + this.loadTimeBeforeTabBecomesInactive;
        }
      } else {
        // Page back in view
        // Reset the start time. During calculation, we add startTime and this.loadTimeBeforeTabBecomesInactive, which contains time taken during previous tab active session(s).
        this.startTime = new Date().getTime();
      }
    }
  };

  private isPuppeteer = () => navigator.webdriver === true;

  private constructDashboardHitRequest(dashboardId: string): any {
    let postBody = {
      events: [
        {
          name: 'api_dashboard_hit',
          value: 1,
          labels: {
            dashboard_id: dashboardId?.toString(),
            tenant_id: config.bootData.user.orgId?.toString(),
          },
        },
        {
          name: 'api_dashboard_hit_with_user_info',
          value: 1,
          labels: {
            dashboard_id: dashboardId?.toString(),
            user_id: config.bootData.user.id?.toString(),
            tenant_id: config.bootData.user.orgId?.toString(),
          },
        },
        {
          name: 'api_user_dashboard_hit',
          value: 1,
          labels: {
            user_id: config.bootData.user.id?.toString(),
            tenant_id: config.bootData.user.orgId?.toString(),
          },
        },
      ],
    };

    return postBody;
  }
  private constructDashboardLoadTimeRequest(loadTime: number, dashboardId: string): any {
    // we consider load time metric only if all panels in view have been loaded sucessfully .
    let postBody = {
      events: [
        {
          name: 'api_dashboard_loadtime',
          value: loadTime,
          labels: {
            dashboard_id: dashboardId?.toString(),
            tenant_id: config.bootData.user.orgId?.toString(),
          },
        },
      ],
    };
    return postBody;
  }

  public static get Instance() {
    return this._instance || (this._instance = new this());
  }
}

export const dashboardLoadTime = DashboardLoadTime.Instance;
