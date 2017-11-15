var _global = <any>(window);
var beforeEach = _global.beforeEach;
var afterEach = _global.afterEach;
var before = _global.before;
var describe = _global.describe;
var it = _global.it;
var sinon = _global.sinon;
var expect = _global.expect;

var angularMocks = {
  module: _global.module,
  inject: _global.inject,
};

export {
  beforeEach,
  afterEach,
  before,
  describe,
  it,
  sinon,
  expect,
  angularMocks,
};
