///<reference path="../../../headers/common.d.ts" />

import {CQLDatasource} from './datasource';
import {CassandraQueryCtrl} from './query_ctrl';

class CassandraConfigCtrl {
  static templateUrl = 'partials/config.html';
  current: any;
  consistencyLevels = ['ONE', 'TWO', 'THREE', 'QUORUM', 'ALL', 'LOCAL_ONE', 'LOCAL_QUORUM'];
  defaultConsistencyLevel = 'ONE';
  protoVersions = ['', '2', '3', '4'];
  defaultProtoVersion = '';

  /** @ngInject */
  constructor($scope) {
    this.current.jsonData.consistency = this.current.jsonData.consistency || this.defaultConsistencyLevel;
    this.current.jsonData.protoVer = this.current.jsonData.protoVer || this.defaultProtoVersion;
  }
}

const defaultQuery = `SELECT
    toUnixTimestamp(<time_column>) as time_ms,
    <title_column> as title,
    <text_column> as text,
    <tags_column> as tags
  FROM <table name>
  WHERE $__timeFilter(time_column)
  LIMIT 100
  `;

class CassandraAnnotationsQueryCtrl {
  static templateUrl = 'partials/annotations.editor.html';

  annotation: any;

  /** @ngInject **/
  constructor() {
    this.annotation.rawQuery = this.annotation.rawQuery || defaultQuery;
  }
}

export {
  CQLDatasource,
  CQLDatasource as Datasource,
  CassandraQueryCtrl as QueryCtrl,
  CassandraConfigCtrl as ConfigCtrl,
  CassandraAnnotationsQueryCtrl as AnnotationsQueryCtrl,
};

