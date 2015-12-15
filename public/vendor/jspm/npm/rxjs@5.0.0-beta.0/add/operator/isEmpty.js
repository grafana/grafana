/* */ 
var Observable_1 = require('../../Observable');
var isEmpty_1 = require('../../operator/isEmpty');
var observableProto = Observable_1.Observable.prototype;
observableProto.isEmpty = isEmpty_1.isEmpty;
