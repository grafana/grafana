import { type DynamicKindRegistry, type KindInfo } from '@grafana/runtime/unstable';

import { CORE_KINDS, coversGroup } from './coreKinds';

const coreKinds: KindInfo[] = Object.values(CORE_KINDS);
const pluginKinds = new Map<string, KindInfo>();

function addKinds(added: KindInfo[]) {
  for (const kind of added) {
    if (!coreKinds.some((row) => row.kind === kind.kind && coversGroup(row, kind.group))) {
      pluginKinds.set(`${kind.group}/${kind.kind}`, kind);
    }
  }
}

function getKinds(): KindInfo[] {
  return [...coreKinds, ...pluginKinds.values()];
}

function findKind(group: string, kind: string): KindInfo | undefined {
  return getKinds().find((row) => row.kind === kind && coversGroup(row, group));
}

export const dynamicKindRegistry = {
  coreKinds: CORE_KINDS,
  coversGroup,
  findKind,
  getKinds,
  addKinds,
} satisfies DynamicKindRegistry;
