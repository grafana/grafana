System.register([], function (_export) {
  "use strict";

  return {
    setters: [],
    execute: function () {

      function Datasource(instanceSettings, backendSrv) {
        this.url = instanceSettings.url;

        // this.testDatasource = function() {
        //   return backendSrv.datasourceRequest({
        //     method: 'GET',
        //     url: this.url  + '/api/v4/search'
        //   });
        // }
        //
        this.testDatasource = function() {
          return backendSrv.datasourceRequest({
            method: 'GET',
            url: this.url  + '/tokenTest'
          });
        }

      }

      function ConfigCtrl() {

      }

      ConfigCtrl.template = `
        <div class="gf-form">
          <label class="gf-form-label width-13">TenantId </label>
          <input type="text" class="gf-form-input max-width-18" ng-model='ctrl.current.jsonData.tenantId'></input>
         </div>
         <div class="gf-form">
          <label class="gf-form-label width-13">ClientId </label>
          <input type="text" class="gf-form-input max-width-18" ng-model='ctrl.current.jsonData.clientId'></input>
         </div>
         <div class="gf-form">
          <label class="gf-form-label width-13">Client secret</label>
          <input type="text" class="gf-form-input max-width-18" ng-model='ctrl.current.secureJsonData.clientSecret'></input>
         </div>
      `;

      _export('Datasource', Datasource);
      _export('ConfigCtrl', ConfigCtrl);
    }
  };
});
