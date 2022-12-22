const _global = window as any;
const sinon = _global.sinon;

const angularMocks = {
  module: _global.module,
  inject: _global.inject,
};

export { sinon, angularMocks };
