const _global = window as any;
const beforeEach = _global.beforeEach;
const afterEach = _global.afterEach;
const before = _global.before;
const describe = _global.describe;
const it = _global.it;
const sinon = _global.sinon;
const expect = _global.expect;

const angularMocks = {
  module: _global.module,
  inject: _global.inject,
};

export { beforeEach, afterEach, before, describe, it, sinon, expect, angularMocks };
