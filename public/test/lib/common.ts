///<reference path="../../app/headers/common.d.ts" />

var _global = <any>(window);
var beforeEach = _global.beforeEach;
var describe = _global.describe;
var it = _global.it;
var sinon = _global.sinon;
var expect = _global.expect;

var angularMocks = {
  module: _global.module,
};

export {
  beforeEach,
  describe,
  it,
  sinon,
  expect,
  angularMocks,
}
