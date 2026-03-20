/**
 * Bridge between DashboardScene and the mutation-api module.
 *
 * DashboardScene cannot import DashboardMutationClient directly because
 * that would pull in the entire command registry and create circular
 * dependencies with scene components.
 *
 * dashboardMutationApi.ts provides the implementation at app init,
 * and DashboardScene calls it on activation without knowing the details.
 */

type CreateMutationClient = (scene: unknown) => () => void;

let _create: CreateMutationClient | null = null;

export function provideMutationClientFactory(create: CreateMutationClient): void {
  _create = create;
}

export function createMutationClient(scene: unknown): () => void {
  if (!_create) {
    console.warn(
      'createMutationClient called before provideMutationClientFactory. Mutation API will not be available.'
    );
    return () => {};
  }
  const teardown = _create(scene);
  return () => teardown?.();
}
