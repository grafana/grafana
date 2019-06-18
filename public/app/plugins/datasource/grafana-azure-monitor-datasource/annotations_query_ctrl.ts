export class AzureMonitorAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  datasource: any;
  annotation: any;
  workspaces: any[];
  subscriptions: Array<{ text: string; value: string }>;

  defaultQuery =
    '<your table>\n| where $__timeFilter() \n| project TimeGenerated, Text=YourTitleColumn, Tags="tag1,tag2"';

  /** @ngInject */
  constructor(private templateSrv) {
    this.annotation.queryType = this.annotation.queryType || 'Azure Log Analytics';
    this.annotation.rawQuery = this.annotation.rawQuery || this.defaultQuery;
    this.initDropdowns();
  }

  async initDropdowns() {
    await this.getSubscriptions();
    await this.getWorkspaces();
  }

  async getSubscriptions() {
    if (!this.datasource.azureMonitorDatasource.isConfigured()) {
      return;
    }

    return this.datasource.azureMonitorDatasource.getSubscriptions().then(subs => {
      this.subscriptions = subs;

      if (!this.annotation.subscription && this.annotation.queryType === 'Azure Log Analytics') {
        this.annotation.subscription = this.datasource.azureLogAnalyticsDatasource.subscriptionId;
      }

      if (!this.annotation.subscription && this.subscriptions.length > 0) {
        this.annotation.subscription = this.subscriptions[0].value;
      }
    });
  }

  async getWorkspaces(bustCache?: boolean) {
    if (!bustCache && this.workspaces && this.workspaces.length > 0) {
      return this.workspaces;
    }

    return this.datasource
      .getAzureLogAnalyticsWorkspaces(this.annotation.subscription)
      .then(list => {
        this.workspaces = list;
        if (list.length > 0 && !this.annotation.workspace) {
          this.annotation.workspace = list[0].value;
        }
        return this.workspaces;
      })
      .catch(() => {});
  }

  getAzureLogAnalyticsSchema = () => {
    return this.getWorkspaces()
      .then(() => {
        return this.datasource.azureLogAnalyticsDatasource.getSchema(this.annotation.workspace);
      })
      .catch(() => {});
  };

  onSubscriptionChange = () => {
    this.getWorkspaces(true);
  };

  onLogAnalyticsQueryChange = (nextQuery: string) => {
    this.annotation.rawQuery = nextQuery;
  };

  get templateVariables() {
    return this.templateSrv.variables.map(t => '$' + t.name);
  }
}
