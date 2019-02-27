export class AzureMonitorAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';
  datasource: any;
  annotation: any;
  workspaces: any[];

  defaultQuery =
    '<your table>\n| where $__timeFilter() \n| project TimeGenerated, Text=YourTitleColumn, Tags="tag1,tag2"';

  /** @ngInject */
  constructor() {
    this.annotation.queryType = this.annotation.queryType || 'Azure Log Analytics';
    this.annotation.rawQuery = this.annotation.rawQuery || this.defaultQuery;
    this.getWorkspaces();
  }

  getWorkspaces() {
    if (this.workspaces && this.workspaces.length > 0) {
      return this.workspaces;
    }

    return this.datasource
      .getAzureLogAnalyticsWorkspaces()
      .then(list => {
        this.workspaces = list;
        if (list.length > 0 && !this.annotation.workspace) {
          this.annotation.workspace = list[0].value;
        }
        return this.workspaces;
      })
      .catch(() => {});
  }
}
