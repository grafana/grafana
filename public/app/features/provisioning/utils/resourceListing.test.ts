import { HttpResponse, http } from 'msw';

import server from '@grafana/test-utils/server';
import { type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';

import { setupProvisioningMswServer } from '../mocks/server';

import { listResources, resourceKindInfos } from './resourceKinds';
import { readImmediateParent } from './resourceListing';

describe('readImmediateParent', () => {
  it('treats a missing location as root (no parent)', () => {
    // DashboardQueryResult.location is optional — a folderless dashboard yields
    // undefined, which must not throw.
    expect(readImmediateParent(undefined)).toBeUndefined();
  });

  it('treats empty and the literal "general" UID as root', () => {
    expect(readImmediateParent('')).toBeUndefined();
    expect(readImmediateParent('   ')).toBeUndefined();
    expect(readImmediateParent('general')).toBeUndefined();
  });

  it('returns the trimmed parent folder UID otherwise', () => {
    expect(readImmediateParent(' team-a ')).toBe('team-a');
  });
});

describe('listing a collection kind', () => {
  setupProvisioningMswServer();

  function discovery(groups: Array<{ name: string; version: string; resource: string }>) {
    return http.get('/apis', () =>
      HttpResponse.json({
        items: groups.map(({ name, version, resource }) => ({
          metadata: { name },
          versions: [{ version, resources: [{ resource, responseKind: {} }] }],
        })),
      })
    );
  }

  function datasources(group: string, version: string, names: string[], spec: Record<string, unknown> = {}) {
    return http.get(`/apis/${group}/${version}/namespaces/:namespace/datasources`, () =>
      HttpResponse.json({ items: names.map((name) => ({ metadata: { name }, spec: { title: name, ...spec } })) })
    );
  }

  const bothServed = () =>
    server.use(
      discovery([
        { name: 'prometheus.datasource.grafana.app', version: 'v0alpha1', resource: 'datasources' },
        { name: 'loki.datasource.grafana.app', version: 'v1beta1', resource: 'datasources' },
        // Neither a member of the collection nor, for the second, a server for the kind.
        { name: 'dashboard.grafana.app', version: 'v1beta1', resource: 'dashboards' },
        { name: 'other.datasource.grafana.app', version: 'v0alpha1', resource: 'connections' },
      ]),
      datasources('prometheus.datasource.grafana.app', 'v0alpha1', ['prom']),
      datasources('loki.datasource.grafana.app', 'v1beta1', ['logs'])
    );

  const prom = { uid: 'prom', title: 'prom', managed: false, group: 'prometheus.datasource.grafana.app' };
  const logs = { uid: 'logs', title: 'logs', managed: false, group: 'loki.datasource.grafana.app' };

  function list(availableResources?: SupportedResource[]) {
    return listResources(resourceKindInfos.datasource, { dispatch: jest.fn(), availableResources });
  }

  it('lists the members of every group discovery serves the kind under', async () => {
    bothServed();

    // Each member carries the group that serves it, which is how a job addresses it.
    await expect(list([{ group: 'datasource.grafana.app', kind: 'DataSource' }])).resolves.toEqual([prom, logs]);
  });

  it('lists every served member before settings declare which ones provisioning acts on', async () => {
    bothServed();

    await expect(list(undefined)).resolves.toEqual([prom, logs]);
  });

  // A member declared on its own reaches the frontend verbatim: only a wildcard pattern is reported
  // as its collection. Enumerating a member provisioning does not act on would offer it for
  // migration and have the job reject the reference.
  it('lists only the member declared, when the collection itself is not', async () => {
    bothServed();

    await expect(list([{ group: 'prometheus.datasource.grafana.app', kind: 'DataSource' }])).resolves.toEqual([prom]);
  });

  it('leaves out a member disabled on its own inside an enabled collection', async () => {
    bothServed();

    await expect(
      list([
        { group: 'datasource.grafana.app', kind: 'DataSource' },
        { group: 'loki.datasource.grafana.app', kind: 'DataSource', disabled: true },
      ])
    ).resolves.toEqual([prom]);
  });

  it('lists a member enabled on its own inside a disabled collection', async () => {
    bothServed();

    await expect(
      list([
        { group: 'datasource.grafana.app', kind: 'DataSource', disabled: true },
        { group: 'loki.datasource.grafana.app', kind: 'DataSource' },
      ])
    ).resolves.toEqual([logs]);
  });

  // Classic file provisioning marks a data source read-only and leaves no manager annotation, so
  // the annotation check alone would offer a resource no write can take over.
  it('reports a read-only member as managed, keeping it out of migration', async () => {
    server.use(
      discovery([{ name: 'prometheus.datasource.grafana.app', version: 'v0alpha1', resource: 'datasources' }]),
      datasources('prometheus.datasource.grafana.app', 'v0alpha1', ['file-prom'], { readOnly: true })
    );

    await expect(list([{ group: 'datasource.grafana.app', kind: 'DataSource' }])).resolves.toEqual([
      { uid: 'file-prom', title: 'file-prom', managed: true, group: 'prometheus.datasource.grafana.app' },
    ]);
  });

  it('lists nothing when no group serves the collection', async () => {
    server.use(discovery([{ name: 'dashboard.grafana.app', version: 'v1beta1', resource: 'dashboards' }]));

    await expect(list([{ group: 'datasource.grafana.app', kind: 'DataSource' }])).resolves.toEqual([]);
  });
});
