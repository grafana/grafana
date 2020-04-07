export interface AngularComponent {
  destroy(): void;
  digest(): void;
  getScope(): any;
}

export interface AngularLoader {
  load(elem: any, scopeProps: any, template: string): AngularComponent;
}

let instance: AngularLoader;

export function setAngularLoader(v: AngularLoader) {
  instance = v;
}

export function getAngularLoader(): AngularLoader {
  return instance;
}
