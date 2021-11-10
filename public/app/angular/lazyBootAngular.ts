import angular, { auto } from 'angular';

let injector: auto.IInjectorService | undefined;

/**
 * Future poc to lazy load angular app, not yet used
 */
export async function getAngularInjector(): Promise<auto.IInjectorService> {
  if (injector) {
    return injector;
  }

  const { AngularApp } = await import(/* webpackChunkName: "AngularApp" */ './index');
  // Remove this logic once AngularApp is loaded asynchronously everywhere
  if (!injector) {
    const $injector = angular.element('#ngRoot').injector();
    injector = $injector;
    return injector;
  }

  const app = new AngularApp();
  app.init();
  injector = app.bootstrap();

  return injector;
}
