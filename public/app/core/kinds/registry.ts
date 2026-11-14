import { CORE_KINDS } from './coreKinds';
import { type KindInfo } from './types';

const kinds: readonly KindInfo[] = Object.values(CORE_KINDS);

/** The kind behind the kind string of a dashboard search row; undefined for kinds not described here, such as panels. */
export function findKindBySearchKind(searchKind: string): KindInfo | undefined {
  return kinds.find((kind) => kind.searchKind === searchKind);
}
