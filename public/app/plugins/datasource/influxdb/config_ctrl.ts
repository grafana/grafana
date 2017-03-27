///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class InfluxConfigCtrl {
  static templateUrl = 'partials/config.html';
  current: any;
  datasourceSrv: any;
  dbSegment: any;


  /** @ngInject **/
  constructor($scope, $injector, private uiSegmentSrv) {
    this.datasourceSrv = $injector.get('datasourceSrv');

      console.log( "BEFORE", this );
   // if (!_.isBoolean(this.current.jsonData.allowDBQuery)) {
   //   this.current.jsonData.allowDBQuery = false;
   // }

    if (!_.isUndefined(this.current.url)) {
      this.current.url = this.current.url.trim().replace(/\/$/,"");
    }

    if (_.isUndefined(this.current.database)) {
      this.dbSegment = uiSegmentSrv.newSegment({value: '-- Enter Database --', fake: true});
    } else {
      this.dbSegment = uiSegmentSrv.newSegment({value: this.current.database});
    }
  }

  getDBSegments() {
    return this.datasourceSrv.get(this.current.name).then(ds => {
      return ds.getDatabases( {} ).then( results => {
        var segs = [];
        for ( let i = 0; i < results.length; i++ ) {
          segs.push( this.uiSegmentSrv.newSegment( results[i].text ) );
        }
        return segs;
      });
    }).catch( ex => {
      console.log( "ERROR Getting", this, this.current.name );
      return []; // empty list
    });
  }

  dbChanged() {
    this.current.database = this.dbSegment.value;

      console.log( "CHANGE", this );
  }
}
