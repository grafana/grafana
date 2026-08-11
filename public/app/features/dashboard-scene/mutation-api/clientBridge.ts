/**
 * Bridge between a document's scene root and the mutation client that serves it.
 *
 * A scene cannot construct its client directly: that would pull in the whole command registry and
 * create circular dependencies with scene components. So the app provides the implementation at init
 * (`dashboardMutationApi.ts`) and each scene calls this on activation without knowing the details.
 *
 * A leaf module on purpose — it imports nothing, so any scene root can depend on it.
 */

/** Which document is mounted, and therefore which commands its client is built with. */
export type MutationResource = 'dashboard' | 'notebook';

type CreateMutationClient = (scene: unknown, resource: MutationResource) => () => void;

let _create: CreateMutationClient | null = null;

export function provideMutationClientFactory(create: CreateMutationClient): void {
  _create = create;
}

/**
 * Mount the mutation client for the scene that is activating, returning its teardown.
 *
 * `resource` is passed rather than inferred from the scene, so the factory does not have to
 * `instanceof`-test scene classes owned by two different features to decide which commands to
 * register.
 */
export function createMutationClient(scene: unknown, resource: MutationResource): () => void {
  if (!_create) {
    console.warn(
      'createMutationClient called before provideMutationClientFactory. Mutation API will not be available.'
    );
    return () => {};
  }
  const teardown = _create(scene, resource);
  return () => teardown?.();
}
