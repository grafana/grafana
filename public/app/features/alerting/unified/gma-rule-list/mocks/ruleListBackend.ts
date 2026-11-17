import { HttpResponse, http } from 'msw';

import { type Folder } from '@grafana/api-clients/rtkq/folder/v1beta1';
import { type AlertRule, type RecordingRule } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';
import server from '@grafana/test-utils/server';

import { type RuleKind } from '../shared/ruleKind';

import { FOLDER_ANNOTATION, folderItem } from './factories';
import { FOLDER_COUNTS_URL, FOLDER_PARENTS_URL, FOLDER_SEARCH_URL, ruleSearchUrl } from './handlers';

type RuleResource = AlertRule | RecordingRule;

type Endpoint = 'folderSearch' | 'ruleSearch' | 'folderParents' | 'folderCounts';

interface InterceptOptions {
  /** Only requests for a later page (`continue` set), or only first pages; any request when omitted. */
  continued?: boolean;
  /** Only rule searches scoped to this folder. */
  folderUid?: string;
}

interface Interceptor extends InterceptOptions {
  endpoint: Endpoint;
  respond: () => Promise<Response | undefined>;
}

interface SearchWhere {
  and?: SearchWhere[];
  text?: { value: string };
  filter?: { field: string; operator: 'In' | 'NotIn'; values: string[] };
}

interface SearchBody {
  where?: SearchWhere;
  limit?: number;
  continue?: string;
}

export interface RuleListBackend {
  /** Every folder search body, in request order. */
  folderSearches: SearchBody[];
  /** Every rule search body, in request order. */
  ruleSearches: SearchBody[];
  /** Fails the next matching request with `status`; later requests are answered normally. */
  failNext: (endpoint: Endpoint, options?: InterceptOptions & { status?: number }) => void;
  /** Holds the next matching request until the returned function is called. */
  holdNext: (endpoint: Endpoint, options?: InterceptOptions) => () => void;
}

/**
 * Serves the folder and rule search APIs of the GMA list pages from one set of folders and rules, so tests
 * describe data and let the page ask for it. Folder search lists folders holding rules, both searches sort by
 * title and page with continue tokens, and counts and parents are derived from the same data.
 */
export function setupRuleListBackend({
  folders,
  alertRules = [],
  recordingRules = [],
  pageSize,
}: {
  folders: Folder[];
  alertRules?: AlertRule[];
  recordingRules?: RecordingRule[];
  /** Overrides the page size the requests ask for, so a small data set still spans several pages. */
  pageSize?: { folders?: number; rules?: number };
}): RuleListBackend {
  const folderSearches: SearchBody[] = [];
  const ruleSearches: SearchBody[] = [];
  const interceptors: Interceptor[] = [];

  const rulesByKind: Record<RuleKind, RuleResource[]> = { alert: alertRules, recording: recordingRules };
  const allRules = [...alertRules, ...recordingRules];
  const folderByUid = new Map(folders.map((folder) => [nameOf(folder), folder]));

  async function intercept(endpoint: Endpoint, body: SearchBody = {}) {
    const index = interceptors.findIndex(
      (candidate) =>
        candidate.endpoint === endpoint &&
        (candidate.continued === undefined || candidate.continued === Boolean(body.continue)) &&
        (candidate.folderUid === undefined || folderFilterValues(body.where)?.includes(candidate.folderUid))
    );
    if (index === -1) {
      return undefined;
    }
    const [interceptor] = interceptors.splice(index, 1);
    return interceptor.respond();
  }

  function page<T>(items: T[], body: SearchBody, size = body.limit ?? items.length) {
    const start = body.continue ? Number(body.continue) : 0;
    const end = start + size;
    return { items: items.slice(start, end), metadata: end < items.length ? { continue: String(end) } : {} };
  }

  server.use(
    http.post(FOLDER_SEARCH_URL, async ({ request }) => {
      const body = (await request.json()) as SearchBody;
      folderSearches.push(body);
      const intercepted = await intercept('folderSearch', body);
      if (intercepted) {
        return intercepted;
      }

      const scope = nameFilterValues(body.where);
      const listed = folders
        .filter((folder) => allRules.some((rule) => parentOf(rule) === nameOf(folder)))
        .filter((folder) => !scope || scope.includes(nameOf(folder)))
        .sort(byTitle)
        .map((folder) => folderItem(nameOf(folder), folder.spec.title));
      return HttpResponse.json(page(listed, body, pageSize?.folders));
    }),

    ...(['alert', 'recording'] as const).map((kind) =>
      http.post(ruleSearchUrl(kind), async ({ request }) => {
        const body = (await request.json()) as SearchBody;
        ruleSearches.push(body);
        const intercepted = await intercept('ruleSearch', body);
        if (intercepted) {
          return intercepted;
        }

        const matching = rulesByKind[kind]
          .filter((rule) => matches(rule, body.where))
          .sort(byTitle)
          .map((rule) => ruleHit(kind, rule));
        return HttpResponse.json(page(matching, body, pageSize?.rules));
      })
    ),

    http.get(FOLDER_PARENTS_URL, async ({ params }) => {
      const intercepted = await intercept('folderParents');
      if (intercepted) {
        return intercepted;
      }
      const path: Folder[] = [];
      for (
        let folder = folderByUid.get(String(params.name));
        folder;
        folder = folderByUid.get(parentOf(folder) ?? '')
      ) {
        path.unshift(folder);
      }
      return HttpResponse.json({ items: path.map((folder) => ({ name: nameOf(folder), title: folder.spec.title })) });
    }),

    http.get(FOLDER_COUNTS_URL, async ({ params }) => {
      const intercepted = await intercept('folderCounts');
      if (intercepted) {
        return intercepted;
      }
      // Like the real endpoint, the response omits kinds the folder holds none of.
      const counts = (['alert', 'recording'] as const)
        .map((kind) => ({
          group: 'rules.alerting.grafana.app',
          resource: kind === 'alert' ? 'alertrules' : 'recordingrules',
          count: rulesByKind[kind].filter((rule) => parentOf(rule) === params.name).length,
        }))
        .filter(({ count }) => count > 0);
      return HttpResponse.json({ counts });
    })
  );

  return {
    folderSearches,
    ruleSearches,
    failNext: (endpoint, { status = 500, ...options } = {}) => {
      interceptors.push({
        endpoint,
        ...options,
        respond: async () => HttpResponse.json({ message: 'request failed' }, { status }),
      });
    },
    holdNext: (endpoint, options = {}) => {
      let release: () => void = () => {};
      const released = new Promise<void>((resolve) => {
        release = resolve;
      });
      interceptors.push({
        endpoint,
        ...options,
        respond: async () => {
          await released;
          return undefined;
        },
      });
      return release;
    },
  };
}

function nameOf(resource: Folder | RuleResource) {
  return resource.metadata.name ?? '';
}

function parentOf(resource: Folder | RuleResource) {
  return resource.metadata.annotations?.[FOLDER_ANNOTATION];
}

function byTitle(a: Folder | RuleResource, b: Folder | RuleResource) {
  return a.spec.title.localeCompare(b.spec.title);
}

function labelEntries(rule: RuleResource) {
  return Object.entries(rule.spec.labels ?? {}).map(([key, value]) => `${key}=${value}`);
}

function leaves(where?: SearchWhere): SearchWhere[] {
  if (!where) {
    return [];
  }
  return where.and ?? [where];
}

function nameFilterValues(where?: SearchWhere) {
  return leaves(where).find((leaf) => leaf.filter?.field === 'name')?.filter?.values;
}

function folderFilterValues(where?: SearchWhere) {
  return leaves(where).find((leaf) => leaf.filter?.field === 'folder')?.filter?.values;
}

/** Supports the leaves the list pages send for folder, title text, labels and paused; any other leaf matches. */
function matches(rule: RuleResource, where?: SearchWhere): boolean {
  return leaves(where).every((leaf) => {
    if (leaf.text) {
      return rule.spec.title.toLowerCase().includes(leaf.text.value.toLowerCase());
    }
    if (!leaf.filter) {
      return true;
    }
    const { field, operator, values } = leaf.filter;
    const ruleValues = fieldValues(rule, field);
    if (ruleValues === undefined) {
      return true;
    }
    const found = values.some((value) => ruleValues.includes(value));
    return operator === 'In' ? found : !found;
  });
}

function fieldValues(rule: RuleResource, field: string): string[] | undefined {
  switch (field) {
    case 'folder':
      return [parentOf(rule) ?? ''];
    case 'labels':
      return labelEntries(rule);
    case 'paused':
      return [String(rule.spec.paused ?? false)];
    default:
      return undefined;
  }
}

function ruleHit(kind: RuleKind, rule: RuleResource) {
  return {
    resource: {
      group: 'rules.alerting.grafana.app',
      kind: rule.kind,
      name: nameOf(rule),
      resource: kind === 'alert' ? 'alertrules' : 'recordingrules',
    },
    fields: {
      title: rule.spec.title,
      folder: parentOf(rule),
      paused: rule.spec.paused ?? false,
      labels: labelEntries(rule),
    },
  };
}
