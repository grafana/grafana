/* */ 
var Observable_1 = require('../../Observable');
var timeInterval_1 = require('../../operator/timeInterval');
var observableProto = Observable_1.Observable.prototype;
observableProto.timeInterval = timeInterval_1.timeInterval;
