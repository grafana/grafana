///<reference path="../../../headers/common.d.ts" />

// Copyright 2016 Foursquare Labs, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import angular from 'angular';
import _ from 'lodash';

/** @ngInject */
export function SqlDatasource(instanceSettings, $q, backendSrv) {
  this.url = instanceSettings.url;

  this._request = function(options) {
    options.url = this.url + options.url;
    options.method = options.method || 'GET';
    options.inspect = { 'type': 'generic_sql' };

    return backendSrv.datasourceRequest(options);
  };

  this.query = function(queryOptions) {
    var self = this;

    var targetPromises = _(queryOptions.targets)
      .filter(function(target) { return target.target && !target.hide; })
      .map(function(target) {
        var requestOptions = {
          url: '/sqldata',
          method: 'POST',
          data: {
            query: target.target,
            from: queryOptions.range.from.unix(),
            to: queryOptions.range.to.unix(),
          }
        };

        return self._request(requestOptions);
      })
      .value();

    return $q.all(targetPromises).then(function(responses) {
      var result = {
        data: _.map(responses, function(response) {
          return response.data;
        })
      };
      result.data = _.flatten(result.data);
      return result;
    });
  };
}
