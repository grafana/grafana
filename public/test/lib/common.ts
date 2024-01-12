const _global = window as any;
const angularMocks = {
  module: _global.module,
  inject: _global.inject,
};

export { angularMocks };
