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

import {SqlDatasource} from './datasource';
import {SqlDatasourceQueryCtrl} from './query_ctrl';

class SqlDatasourceConfigCtrl {
  static templateUrl = 'public/app/plugins/datasource/generic_sql/partials/config.html';
}

export {
  SqlDatasource as Datasource,
  SqlDatasourceQueryCtrl as QueryCtrl,
  SqlDatasourceConfigCtrl as ConfigCtrl,
};
