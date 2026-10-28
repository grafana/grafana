/**
 * @alpha
 */
export interface ResourceKindDisplay {
  group: string;
  kind: string;
  resource?: string;
  label?: string;
  icon?: string;
  getRoute?: (name: string) => string;
  listRoute?: string;
  folderScoped?: boolean;
}

type RegisterResourceKinds = (kinds: ResourceKindDisplay[]) => void;

const pending: ResourceKindDisplay[][] = [];
let registerResourceKindsImpl: RegisterResourceKinds = (kinds) => {
  pending.push(kinds);
};

/**
 * @alpha
 */
export function registerResourceKinds(kinds: ResourceKindDisplay[]) {
  registerResourceKindsImpl(kinds);
}

/**
 * @internal
 */
export function setRegisterResourceKinds(impl: RegisterResourceKinds) {
  registerResourceKindsImpl = impl;
  pending.splice(0).forEach(impl);
}
