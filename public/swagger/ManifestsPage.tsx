import { css } from '@emotion/css';
import { Fragment, useMemo, useState } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Badge, Button, Icon, IconButton, Input, Stack, Text, TextLink, Tooltip, useStyles2 } from '@grafana/ui';

import { getTableStyles, RouterShell, Table } from './RouterShell';
import { type GroupStatus, healthColors, type RouterStatus, routerStatusURL, SourceBadge } from './RouterStatusPage';

export const manifestsURL = 'apis/discovery/v1alpha2/manifests';

// The parts of the app-sdk apps.grafana.app/v1alpha2 AppManifest that this page shows
export interface AppManifest {
  metadata: { name: string };
  spec: {
    appName: string;
    appDisplayName: string;
    group: string;
    versions: ManifestVersion[];
    preferredVersion?: string;
    roles?: Record<string, { title: string; description: string }>;
  };
}

interface ManifestVersion {
  name: string;
  served?: boolean;
  kinds?: ManifestKind[];
  routes?: { namespaced?: Record<string, unknown>; cluster?: Record<string, unknown> };
  openapi?: { paths?: Record<string, unknown> };
}

interface ManifestKind {
  kind: string;
  plural?: string;
  scope: string;
  userReadable?: boolean;
  folderScoped?: boolean;
  admission?: {
    validation?: { operations: string[] };
    mutation?: { operations: string[] };
  };
  conversion?: boolean;
  secure?: unknown[];
  selectableFields?: string[];
  search?: { endpoint?: boolean; trash?: boolean; hybrid?: boolean; global?: boolean };
  embed?: unknown;
  routes?: Record<string, unknown>;
}

const preferredVersion = (m: AppManifest) => m.spec.preferredVersion || m.spec.versions.at(-1)?.name;

const isServed = (v: ManifestVersion) => v.served !== false;

// Version routes moved from routes to openapi.paths; manifests may still use either
const versionRoutes = (v: ManifestVersion) => [
  ...Object.keys(v.openapi?.paths ?? {}),
  ...Object.keys(v.routes?.namespaced ?? {}),
  ...Object.keys(v.routes?.cluster ?? {}),
];

// Defaults follow the AppManifest schema: /search and /trash are served unless
// disabled, hybrid search and the global index only when enabled
function searchFeatures(kind: ManifestKind) {
  const s = kind.search ?? {};
  const features: string[] = [];
  if (s.endpoint !== false) {
    features.push('search');
  }
  if (s.trash !== false) {
    features.push('trash');
  }
  if (s.hybrid) {
    features.push('hybrid');
  }
  if (s.global) {
    features.push('global');
  }
  return features;
}

// Capabilities of any kind in the version, for the summary row
function capabilities(version?: ManifestVersion) {
  const kinds = version?.kinds ?? [];
  const caps: string[] = [];
  const add = (name: string, has: (k: ManifestKind) => boolean) => kinds.some(has) && caps.push(name);
  add('validation', (k) => Boolean(k.admission?.validation?.operations?.length));
  add('mutation', (k) => Boolean(k.admission?.mutation?.operations?.length));
  add('conversion', (k) => Boolean(k.conversion));
  add('hybrid search', (k) => Boolean(k.search?.hybrid));
  add('global search', (k) => Boolean(k.search?.global));
  add('secure values', (k) => Boolean(k.secure?.length));
  add('embed', (k) => Boolean(k.embed));
  return caps;
}

export const ManifestsPage = () => {
  const manifests = useAsyncRetry(async () => {
    const rsp = await fetch(manifestsURL, { cache: 'no-store' });
    if (!rsp.ok) {
      throw new Error(`HTTP ${rsp.status} ${rsp.statusText}`);
    }
    const list: { items: AppManifest[] } = await rsp.json();
    return list.items ?? [];
  });
  // Status only adds a column, so the page still shows the manifests when it fails
  const status = useAsyncRetry(async () => {
    const rsp = await fetch(routerStatusURL, { cache: 'no-store' });
    if (!rsp.ok) {
      return new Map<string, GroupStatus>();
    }
    const doc: RouterStatus = await rsp.json();
    return new Map(doc.groups.map((g) => [g.group, g]));
  });

  return (
    <RouterShell
      page="manifests"
      actions={
        <Button
          icon="sync"
          variant="secondary"
          onClick={() => {
            manifests.retry();
            status.retry();
          }}
          disabled={manifests.loading}
        >
          <Trans i18nKey="swagger.manifests.refresh">Refresh</Trans>
        </Button>
      }
    >
      {manifests.error && (
        <Alert title={t('swagger.manifests.error-title', 'Unable to load manifests')} severity="error">
          {manifests.error.message}
        </Alert>
      )}
      {manifests.value && <ManifestsView manifests={manifests.value} status={status.value} />}
      {!manifests.value && manifests.loading && <div>...</div>}
    </RouterShell>
  );
};

const ManifestsView = ({ manifests, status }: { manifests: AppManifest[]; status?: Map<string, GroupStatus> }) => {
  const styles = useStyles2(getTableStyles);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return manifests;
    }
    return manifests.filter((m) =>
      [
        m.metadata.name,
        m.spec.appName,
        m.spec.appDisplayName,
        ...m.spec.versions.flatMap((v) => (v.kinds ?? []).map((k) => k.kind)),
      ].some((v) => v?.toLowerCase().includes(q))
    );
  }, [manifests, query]);

  const toggle = (name: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(name)) {
        next.add(name);
      }
      return next;
    });

  const headers = [
    '',
    'App',
    'Group',
    'Status',
    'Preferred',
    'Versions',
    'Kinds',
    'Routes',
    'Roles',
    'Capabilities',
    '',
  ];

  return (
    <Stack direction="column" gap={2}>
      <Text element="h2">
        <Trans i18nKey="swagger.manifests.title">App manifests</Trans>
      </Text>
      <Stack gap={1} alignItems="center">
        <Input
          prefix={<Icon name="search" />}
          placeholder={t('swagger.manifests.filter-placeholder', 'Filter by group, app or kind')}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          width={40}
        />
        <Text color="secondary">
          <Trans i18nKey="swagger.manifests.count" values={{ shown: filtered.length, total: manifests.length }}>
            {'{{shown}}'} of {'{{total}}'}
          </Trans>
        </Text>
        <Button
          variant="secondary"
          fill="text"
          size="sm"
          onClick={() => setExpanded(expanded.size ? new Set() : new Set(filtered.map((m) => m.metadata.name)))}
        >
          {expanded.size
            ? t('swagger.manifests.collapse-all', 'Collapse all')
            : t('swagger.manifests.expand-all', 'Expand all')}
        </Button>
      </Stack>
      <div className={styles.wrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => {
              const name = m.metadata.name;
              const isOpen = expanded.has(name);
              return (
                <Fragment key={name}>
                  <ManifestRow manifest={m} status={status?.get(name)} open={isOpen} onToggle={() => toggle(name)} />
                  {isOpen && (
                    <tr>
                      <td />
                      <td colSpan={headers.length - 1}>
                        <ManifestDetails manifest={m} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Stack>
  );
};

const ManifestRow = ({
  manifest,
  status,
  open,
  onToggle,
}: {
  manifest: AppManifest;
  status?: GroupStatus;
  open: boolean;
  onToggle: () => void;
}) => {
  const styles = useStyles2(getStyles);
  const { spec } = manifest;
  const preferred = preferredVersion(manifest);
  const version = spec.versions.find((v) => v.name === preferred);
  const kinds = version?.kinds ?? [];
  const routes = version ? versionRoutes(version) : [];
  const roles = Object.keys(spec.roles ?? {});
  const group = manifest.metadata.name;

  return (
    <tr className={styles.row} onClick={onToggle}>
      <td>
        <IconButton
          name={open ? 'angle-down' : 'angle-right'}
          aria-label={open ? t('swagger.manifests.collapse', 'Collapse') : t('swagger.manifests.expand', 'Expand')}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
        />
      </td>
      <td>
        <Stack direction="column" gap={0}>
          <span>{spec.appDisplayName || spec.appName}</span>
          {spec.appDisplayName && spec.appDisplayName !== spec.appName && (
            <Text color="secondary" variant="bodySmall">
              {spec.appName}
            </Text>
          )}
        </Stack>
      </td>
      <td>
        <code>{group}</code>
      </td>
      <td>
        {status ? (
          <Stack gap={0.5}>
            <Badge color={healthColors[status.health] ?? 'darkgrey'} text={status.health} />
            <Tooltip content={<code>{status.key}</code>}>
              <span>
                <SourceBadge source={status.source} />
              </span>
            </Tooltip>
          </Stack>
        ) : (
          <Text color="secondary">-</Text>
        )}
      </td>
      <td>{preferred ?? '-'}</td>
      <td>
        <Stack gap={0.5}>
          {spec.versions.map((v) =>
            isServed(v) ? (
              <Badge key={v.name} color={v.name === preferred ? 'blue' : 'darkgrey'} text={v.name} />
            ) : (
              <Tooltip key={v.name} content={t('swagger.manifests.not-served', 'Not served')}>
                <span className={styles.unserved}>{v.name}</span>
              </Tooltip>
            )
          )}
        </Stack>
      </td>
      <td>
        <Tooltip content={kinds.map((k) => k.kind).join(', ') || '-'}>
          <span>{kinds.length}</span>
        </Tooltip>
      </td>
      <td>{routes.length || <Text color="secondary">0</Text>}</td>
      <td>
        {roles.length ? (
          <Tooltip content={roles.join(', ')}>
            <span>{roles.length}</span>
          </Tooltip>
        ) : (
          <Text color="secondary">0</Text>
        )}
      </td>
      <td>
        <Stack gap={0.5} wrap="wrap">
          {capabilities(version).map((c) => (
            <Badge key={c} color="purple" text={c} />
          ))}
        </Stack>
      </td>
      <td onClick={(e) => e.stopPropagation()}>
        <Stack gap={1}>
          {preferred && (
            <a className={styles.link} href={docsURL(group, preferred)}>
              {t('swagger.manifests.api-docs', 'API docs')}
            </a>
          )}
          <TextLink href={`${manifestsURL}/${group}`} external inline={false}>
            JSON
          </TextLink>
        </Stack>
      </td>
    </tr>
  );
};

const ManifestDetails = ({ manifest }: { manifest: AppManifest }) => {
  const roles = Object.entries(manifest.spec.roles ?? {});
  return (
    <Stack direction="column" gap={2}>
      {manifest.spec.versions.map((v) => (
        <VersionDetails key={v.name} manifest={manifest} version={v} />
      ))}
      {roles.length > 0 && (
        <Stack direction="column" gap={1}>
          <Text element="h4">
            <Trans i18nKey="swagger.manifests.roles">Roles</Trans>
          </Text>
          <Table
            headers={['Role', 'Title', 'Description']}
            rows={roles.map(([name, role]) => [<code key="name">{name}</code>, role.title, role.description])}
          />
        </Stack>
      )}
    </Stack>
  );
};

interface Operation {
  method: string;
  path: string;
  tag: string;
  href: string;
}

const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

// Matches swagger-ui's deep links, #/{tag}/{operationId}, with whitespace as %20
const deepLinkPath = (value: string) => value.trim().replace(/\s/g, '%20');

// The API server may rename a route's operation (it adds a verb prefix, or
// derives one from the path), so links come from the served OpenAPI document
// rather than from the manifest.
const operationsCache = new Map<string, Promise<Operation[]>>();

function loadOperations(group: string, version: string): Promise<Operation[]> {
  const key = `${group}/${version}`;
  let ops = operationsCache.get(key);
  if (!ops) {
    ops = fetch(`openapi/v3/apis/${key}`)
      .then((rsp) => (rsp.ok ? rsp.json() : { paths: {} }))
      .then((doc: { paths?: Record<string, Record<string, { operationId?: string; tags?: string[] }>> }) =>
        Object.entries(doc.paths ?? {}).flatMap(([path, item]) =>
          methods
            .filter((m) => item[m]?.operationId)
            .map((m) => {
              const tag = item[m].tags?.[0] ?? 'default';
              return {
                method: m.toUpperCase(),
                path,
                tag,
                href: `${docsURL(group, version)}#/${deepLinkPath(tag)}/${deepLinkPath(item[m].operationId!)}`,
              };
            })
        )
      )
      .catch(() => {
        operationsCache.delete(key);
        return [];
      });
    operationsCache.set(key, ops);
  }
  return ops;
}

const docsURL = (group: string, version: string) => `swagger?api=${group}-${version}`;

const withSlash = (path: string) => (path.startsWith('/') ? path : `/${path}`);

const VersionDetails = ({ manifest, version: v }: { manifest: AppManifest; version: ManifestVersion }) => {
  const styles = useStyles2(getStyles);
  const group = manifest.metadata.name;
  const routes = versionRoutes(v);
  const served = isServed(v);
  const operations = useAsync(async () => (served ? loadOperations(group, v.name) : []), [group, v.name, served]);

  const prefix = `/apis/${group}/${v.name}`;
  const routeOps = (route: string) => (operations.value ?? []).filter((op) => op.path === prefix + withSlash(route));
  // Subresource path parameters are named by the server, so match on the resource and subresource only
  const subresourceOps = (plural: string, sub: string) =>
    (operations.value ?? []).filter((op) => {
      const tail = withSlash(sub);
      if (!op.path.startsWith(prefix + '/') || !op.path.endsWith(tail)) {
        return false;
      }
      const parts = op.path.slice(0, -tail.length).split('/');
      return parts.at(-2) === plural && /^\{.+\}$/.test(parts.at(-1) ?? '');
    });

  // The kind's section in the API docs is the tag of its collection operations
  const kindHref = (plural: string) => {
    const op = (operations.value ?? []).find(
      (op) => op.path.startsWith(prefix + '/') && op.path.split('/').at(-1) === plural
    );
    return op && `${docsURL(group, v.name)}#/${deepLinkPath(op.tag)}`;
  };

  return (
    <Stack direction="column" gap={1}>
      <Stack gap={1} alignItems="center">
        <Text element="h4">{v.name}</Text>
        {v.name === preferredVersion(manifest) && (
          <Badge color="blue" text={t('swagger.manifests.preferred', 'preferred')} />
        )}
        {!served && <Badge color="orange" text={t('swagger.manifests.not-served', 'Not served')} />}
      </Stack>
      {v.kinds?.length ? (
        <Table
          headers={[
            'Kind',
            'Plural',
            'Scope',
            'Admission',
            'Conversion',
            'Search',
            'Selectable fields',
            'Secure',
            'Subresources',
          ]}
          rows={v.kinds.map((k) => {
            const plural = k.plural ?? `${k.kind.toLowerCase()}s`;
            const subresources = Object.keys(k.routes ?? {});
            const href = kindHref(plural);
            return [
              href ? (
                <a key="kind" className={styles.link} href={href}>
                  <span>{k.kind}</span>
                </a>
              ) : (
                k.kind
              ),
              plural,
              <ScopeCell key="scope" kind={k} />,
              <AdmissionCell key="admission" kind={k} />,
              k.conversion ? 'yes' : <Text color="secondary">no</Text>,
              searchFeatures(k).join(', ') || <Text color="secondary">none</Text>,
              k.selectableFields?.join(', ') || <Text color="secondary">-</Text>,
              k.secure?.length || <Text color="secondary">0</Text>,
              subresources.length ? (
                <Stack key="subresources" direction="column" gap={0}>
                  {subresources.map((sub) => (
                    <RouteLinks key={sub} route={sub} operations={subresourceOps(plural, sub)} />
                  ))}
                </Stack>
              ) : (
                <Text color="secondary">-</Text>
              ),
            ];
          })}
        />
      ) : (
        <Text color="secondary">
          <Trans i18nKey="swagger.manifests.no-kinds">No kinds</Trans>
        </Text>
      )}
      {routes.length > 0 && (
        <Stack direction="column" gap={0.5}>
          <Text color="secondary">
            <Trans i18nKey="swagger.manifests.routes">Routes:</Trans>
          </Text>
          {routes.map((r) => (
            <RouteLinks key={r} route={r} operations={routeOps(r)} />
          ))}
        </Stack>
      )}
    </Stack>
  );
};

// A route links to each of its operations in the API docs, or shows as text when the
// served OpenAPI document does not have it
const RouteLinks = ({ route, operations }: { route: string; operations: Operation[] }) => {
  const styles = useStyles2(getStyles);
  if (!operations.length) {
    return <code>{route}</code>;
  }
  return (
    <Stack gap={1} alignItems="center">
      {operations.map((op) => (
        <a key={op.href} className={styles.link} href={op.href}>
          <span className={styles.method}>{op.method}</span>
          <code>{route}</code>
        </a>
      ))}
    </Stack>
  );
};

// folderScoped only applies to namespaced kinds and defaults to true; userReadable only to cluster kinds
const ScopeCell = ({ kind }: { kind: ManifestKind }) => {
  const note =
    kind.scope === 'Cluster'
      ? kind.userReadable && t('swagger.manifests.user-readable', 'user readable')
      : kind.folderScoped !== false && t('swagger.manifests.folder-scoped', 'folder scoped');
  return (
    <Stack direction="column" gap={0}>
      <span>{kind.scope}</span>
      {note && (
        <Text color="secondary" variant="bodySmall">
          {note}
        </Text>
      )}
    </Stack>
  );
};

const AdmissionCell = ({ kind }: { kind: ManifestKind }) => {
  const validation = kind.admission?.validation?.operations ?? [];
  const mutation = kind.admission?.mutation?.operations ?? [];
  if (!validation.length && !mutation.length) {
    return <Text color="secondary">-</Text>;
  }
  return (
    <Stack direction="column" gap={0}>
      {validation.length > 0 && <span>{`validate: ${validation.join(', ')}`}</span>}
      {mutation.length > 0 && <span>{`mutate: ${mutation.join(', ')}`}</span>}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  row: css({
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  link: css({
    color: theme.colors.text.link,
    '&:hover': {
      textDecoration: 'underline',
    },
  }),
  method: css({
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    marginRight: theme.spacing(0.5),
  }),
  unserved: css({
    color: theme.colors.text.disabled,
    textDecoration: 'line-through',
    padding: theme.spacing(0, 0.5),
  }),
});
