define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('ZabbixAPI', function($q, backendSrv) {

    function ZabbixAPI(api_url, username, password, basicAuth, withCredentials) {
      // Initialize API parameters.
      this.url              = api_url;
      this.username         = username;
      this.password         = password;
      this.basicAuth        = basicAuth;
      this.withCredentials  = withCredentials;
    }

    var p = ZabbixAPI.prototype;

    //////////////////
    // Core methods //
    //////////////////

    /**
     * Request data from Zabbix API
     *
     * @param  {string} method Zabbix API method name
     * @param  {object} params method params
     * @return {object}        data.result field or []
     */
    p.performZabbixAPIRequest = function(method, params) {
      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        url: this.url,
        data: {
          jsonrpc: '2.0',
          method: method,
          params: params,
          auth: this.auth,
          id: 1
        }
      };

      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers.Authorization = this.basicAuth;
      }

      var self = this;
      return backendSrv.datasourceRequest(options).then(function (response) {
        if (!response.data) {
          return [];
        }
        // Handle Zabbix API errors
        else if (response.data.error) {

          // Handle auth errors
          if (response.data.error.data === "Session terminated, re-login, please." ||
              response.data.error.data === "Not authorised." ||
              response.data.error.data === "Not authorized") {
            return self.performZabbixAPILogin().then(function (response) {
              self.auth = response;
              return self.performZabbixAPIRequest(method, params);
            });
          }
        }
        return response.data.result;
      });
    };

    /**
     * Get authentication token.
     *
     * @return {string}  auth token
     */
    p.performZabbixAPILogin = function() {
      var options = {
        url : this.url,
        method : 'POST',
        data: {
          jsonrpc: '2.0',
          method: 'user.login',
          params: {
            user: this.username,
            password: this.password
          },
          auth: null,
          id: 1
        },
      };

      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers = options.headers || {};
        options.headers.Authorization = this.basicAuth;
      }

      return backendSrv.datasourceRequest(options).then(function (result) {
        if (!result.data) {
          return null;
        }
        return result.data.result;
      });
    };

    /////////////////////////
    // API method wrappers //
    /////////////////////////

    /**
     * Request version of the Zabbix API.
     *
     * @return {string} Zabbix API version
     */
    p.getZabbixAPIVersion = function() {
      var options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        url: this.url,
        data: {
          jsonrpc: '2.0',
          method: 'apiinfo.version',
          params: [],
          id: 1
        }
      };

      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers = options.headers || {};
        options.headers.Authorization = this.basicAuth;
      }

      return backendSrv.datasourceRequest(options).then(function (result) {
        if (!result.data) {
          return null;
        }
        return result.data.result;
      });
    };

    /**
     * Perform history query from Zabbix API
     *
     * @param  {Array}  items Array of Zabbix item objects
     * @param  {Number} start Time in seconds
     * @param  {Number} end   Time in seconds
     * @return {Array}        Array of Zabbix history objects
     */
    p.getHistory = function(items, start, end) {
      // Group items by value type
      var grouped_items = _.groupBy(items, 'value_type');

      // Perform request for each value type
      return $q.all(_.map(grouped_items, function (items, value_type) {
        var itemids = _.map(items, 'itemid');
        var params = {
          output: 'extend',
          history: value_type,
          itemids: itemids,
          sortfield: 'clock',
          sortorder: 'ASC',
          time_from: start
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (end) {
          params.time_till = end;
        }

        return this.performZabbixAPIRequest('history.get', params);
      }, this)).then(function (results) {
        return _.flatten(results);
      });
    };

    /**
     * Perform trends query from Zabbix API
     * Use trends api extension from ZBXNEXT-1193 patch.
     *
     * @param  {Array}  items Array of Zabbix item objects
     * @param  {Number} start Time in seconds
     * @param  {Number} end   Time in seconds
     * @return {Array}        Array of Zabbix trend objects
     */
    p.getTrends = function(items, start, end) {
      // Group items by value type
      var grouped_items = _.groupBy(items, 'value_type');

      // Perform request for each value type
      return $q.all(_.map(grouped_items, function (items, value_type) {
        var itemids = _.map(items, 'itemid');
        var params = {
          output: 'extend',
          trend: value_type,
          itemids: itemids,
          sortfield: 'clock',
          sortorder: 'ASC',
          time_from: start
        };

        // Relative queries (e.g. last hour) don't include an end time
        if (end) {
          params.time_till = end;
        }

        return this.performZabbixAPIRequest('trend.get', params);
      }, this)).then(function (results) {
        return _.flatten(results);
      });
    };

    /**
     * Get the list of host groups
     *
     * @return {array}          array of Zabbix hostgroup objects
     */
    p.performHostGroupSuggestQuery = function() {
      var params = {
        output: ['name'],
        sortfield: 'name',
        // Return only host groups that contain hosts
        real_hosts: true,
        // Return only host groups that contain monitored hosts.
        monitored_hosts: true
      };

      return this.performZabbixAPIRequest('hostgroup.get', params);
    };

    /**
     * Get the list of hosts
     *
     * @param  {array} groupids
     * @return {array}          array of Zabbix host objects
     */
    p.performHostSuggestQuery = function(groupids) {
      var params = {
        output: ['name', 'host'],
        sortfield: 'name',
        // Return only hosts that have items with numeric type of information.
        with_simple_graph_items: true,
        // Return only monitored hosts.
        monitored_hosts: true
      };
      // Return only hosts in given group
      if (groupids) {
        params.groupids = groupids;
      }
      return this.performZabbixAPIRequest('host.get', params);
    };

    /**
     * Get the list of applications
     *
     * @param  {array} hostids
     * @param  {array} groupids
     * @return {array}          array of Zabbix application objects
     */
    p.performAppSuggestQuery = function(hostids, /* optional */ groupids) {
      var params = {
        output: ['name'],
        sortfield: 'name'
      };
      if (hostids) {
        params.hostids = hostids;
      }
      else if (groupids) {
        params.groupids = groupids;
      }

      return this.performZabbixAPIRequest('application.get', params);
    };

    /**
     * Items request
     *
     * @param  {string or Array} hostids          ///////////////////////////
     * @param  {string or Array} applicationids   // Zabbix API parameters //
     * @param  {string or Array} groupids         ///////////////////////////
     * @return {string or Array}                  Array of Zabbix API item objects
     */
    p.performItemSuggestQuery = function(hostids, applicationids, /* optional */ groupids) {
      var params = {
        output: ['name', 'key_', 'value_type', 'delay'],
        sortfield: 'name',
        //Include web items in the result
        webitems: true,
        // Return only numeric items
        filter: {
          value_type: [0,3]
        },
        // Return only enabled items
        monitored: true,
        searchByAny: true
      };

      // Filter by hosts or by groups
      if (hostids) {
        params.hostids = hostids;
      } else if (groupids) {
        params.groupids = groupids;
      }

      // If application selected return only relative items
      if (applicationids) {
        params.applicationids = applicationids;
      }

      // Return host property for multiple hosts
      if (!hostids || (_.isArray(hostids) && hostids.length  > 1)) {
        params.selectHosts = ['name'];
      }

      return this.performZabbixAPIRequest('item.get', params);
    };

    /**
     * Get groups by names
     *
     * @param  {string or array} group group names
     * @return {array}                 array of Zabbix API hostgroup objects
     */
    p.getGroupByName = function (group) {
      var params = {
        output: ['name']
      };
      if (group && group[0] !== '*') {
        params.filter = {
          name: group
        };
      }
      return this.performZabbixAPIRequest('hostgroup.get', params);
    };

    /**
     * Search group by name.
     *
     * @param  {string} group group name
     * @return {array}        groups
     */
    p.searchGroup = function (group) {
      var params = {
        output: ['name'],
        search: {
          name: group
        },
        searchWildcardsEnabled: true
      };
      return this.performZabbixAPIRequest('hostgroup.get', params);
    };

    /**
     * Get hosts by names
     *
     * @param  {string or array} hostnames hosts names
     * @return {array}                     array of Zabbix API host objects
     */
    p.getHostByName = function (hostnames) {
      var params = {
        output: ['host', 'name']
      };
      if (hostnames && hostnames[0] !== '*') {
        params.filter = {
          name: hostnames
        };
      }
      return this.performZabbixAPIRequest('host.get', params);
    };

    /**
     * Get applications by names
     *
     * @param  {string or array} application applications names
     * @return {array}                       array of Zabbix API application objects
     */
    p.getAppByName = function (application) {
      var params = {
        output: ['name']
      };
      if (application && application[0] !== '*') {
        params.filter = {
          name: application
        };
      }
      return this.performZabbixAPIRequest('application.get', params);
    };

    /**
     * Get items belongs to passed groups, hosts and
     * applications
     *
     * @param  {string or array} groups
     * @param  {string or array} hosts
     * @param  {string or array} apps
     * @return {array}  array of Zabbix API item objects
     */
    p.itemFindQuery = function(groups, hosts, apps) {
      var promises = [];

      // Get hostids from names
      if (hosts && hosts[0] !== '*') {
        promises.push(this.getHostByName(hosts));
      }
      // Get groupids from names
      else if (groups) {
        promises.push(this.getGroupByName(groups));
      }
      // Get applicationids from names
      if (apps && apps[0] !== '*') {
        promises.push(this.getAppByName(apps));
      }

      var self = this;
      return $q.all(promises).then(function (results) {
        results = _.flatten(results);
        var groupids;
        var hostids;
        var applicationids;
        if (groups) {
          groupids = _.map(_.filter(results, function (object) {
            return object.groupid;
          }), 'groupid');
        }
        if (hosts && hosts[0] !== '*') {
          hostids = _.map(_.filter(results, function (object) {
            return object.hostid;
          }), 'hostid');
        }
        if (apps && apps[0] !== '*') {
          applicationids = _.map(_.filter(results, function (object) {
            return object.applicationid;
          }), 'applicationid');
        }

        return self.performItemSuggestQuery(hostids, applicationids, groupids);
      });
    };

    /**
     * Find applications belongs to passed groups and hosts
     *
     * @param  {string or array} hosts
     * @param  {string or array} groups
     * @return {array}  array of Zabbix API application objects
     */
    p.appFindQuery = function(hosts, groups) {
      var promises = [];

      // Get hostids from names
      if (hosts && hosts[0] !== '*') {
        promises.push(this.getHostByName(hosts));
      }
      // Get groupids from names
      else if (groups) {
        promises.push(this.getGroupByName(groups));
      }

      var self = this;
      return $q.all(promises).then(function (results) {
        results = _.flatten(results);
        var groupids;
        var hostids;
        if (groups) {
          groupids = _.map(_.filter(results, function (object) {
            return object.groupid;
          }), 'groupid');
        }
        if (hosts && hosts[0] !== '*') {
          hostids = _.map(_.filter(results, function (object) {
            return object.hostid;
          }), 'hostid');
        }

        return self.performAppSuggestQuery(hostids, groupids);
      });
    };

    /**
     * Find hosts belongs to passed groups
     *
     * @param  {string or array} groups
     * @return {array}  array of Zabbix API host objects
     */
    p.hostFindQuery = function(groups) {
      var self = this;
      return this.getGroupByName(groups).then(function (results) {
        results = _.flatten(results);
        var groupids = _.map(_.filter(results, function (object) {
          return object.groupid;
        }), 'groupid');

        return self.performHostSuggestQuery(groupids);
      });
    };

    return ZabbixAPI;

  });

});
