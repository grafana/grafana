import { auto } from 'angular';

let injector: auto.IInjectorService | undefined;

export async function getAngularInjector(): Promise<auto.IInjectorService> {
  if (injector) {
    return injector;
  }

  const { AngularApp } = await import(/* webpackChunkName: "AngularApp" */ './index');
  if (injector) {
    return injector;
  }

  const app = new AngularApp();
  app.init();
  injector = app.bootstrap();

  return injector;
}
