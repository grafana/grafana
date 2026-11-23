import { type KindInfo } from './KindRegistry';

export interface DynamicKindRegistry {
  readonly getKinds: () => KindInfo[];
  readonly findKind: (group: string, kind: string) => KindInfo | undefined;
  readonly addKinds: (kinds: KindInfo[]) => void;
}

let singletonInstance: DynamicKindRegistry | undefined;

export function setDynamicKindRegistry(instance: DynamicKindRegistry) {
  singletonInstance = instance;
}

export function getDynamicKindRegistry(): DynamicKindRegistry {
  if (!singletonInstance) {
    throw new Error(
      'DynamicKindRegistry is not set. Grafana sets it at startup; plugin tests mock getDynamicKindRegistry.'
    );
  }
  return singletonInstance;
}
