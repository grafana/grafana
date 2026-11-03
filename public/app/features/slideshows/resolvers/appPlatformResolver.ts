import { type IconName } from '@grafana/data';
import { config, getBackendSrv, type PlaylistItemKind } from '@grafana/runtime';

interface AppPlatformResolverOptions {
  group: string;
  version: string;
  resource: string;
  title: string;
  icon: IconName;
  /** In-app URL that opens the object, built from its name. */
  viewUrl: (name: string) => string;
}

interface ObjectResponse {
  metadata?: { name?: string };
  spec?: { title?: string };
}

interface SearchResponse {
  items?: Array<{ resource: { name: string }; fields?: Record<string, unknown> }>;
}

// Both calls run as the signed-in user, so a missing or forbidden object looks the same to the
// caller and a picker only offers what the user is allowed to list.
const quiet = { showErrorAlert: false };

function isStatus(err: unknown, ...statuses: number[]): boolean {
  return typeof err === 'object' && err !== null && 'status' in err && statuses.includes(Number(err.status));
}

/**
 * Builds the playlist item kind for an App Platform resource that follows the standard
 * conventions: a `spec.title`, a get-by-name route and the per-kind search route.
 */
export function createAppPlatformResolver(options: AppPlatformResolverOptions): PlaylistItemKind {
  const base = () => `/apis/${options.group}/${options.version}/namespaces/${config.namespace}/${options.resource}`;

  return {
    group: options.group,
    resource: options.resource,
    title: options.title,
    icon: options.icon,

    async resolve(name) {
      try {
        const obj = await getBackendSrv().get<ObjectResponse>(
          `${base()}/${encodeURIComponent(name)}`,
          undefined,
          undefined,
          quiet
        );
        return { url: options.viewUrl(name), title: obj.spec?.title || name };
      } catch (err) {
        if (isStatus(err, 403, 404)) {
          return undefined;
        }
        throw err;
      }
    },

    async search(query, limit) {
      const res = await getBackendSrv().post<SearchResponse>(
        `${base()}/search`,
        {
          apiVersion: 'search.grafana.app/v0alpha1',
          kind: 'SearchQuery',
          ...(query ? { where: { text: { value: query, fields: ['title'] } } } : {}),
          fields: ['title'],
          limit,
        },
        quiet
      );
      return (res.items ?? []).map((item) => {
        const title = item.fields?.title;
        return { name: item.resource.name, title: typeof title === 'string' && title ? title : item.resource.name };
      });
    },
  };
}
