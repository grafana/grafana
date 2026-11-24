import { createTheme } from '@grafana/data';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import rolloutFixture from '../../../../../devenv/dev-dashboards/dashboard-report-layouts/payments-rollout.json';
import { transformSaveModelSchemaV2ToScene } from '../serialization/transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from '../serialization/transformSceneToSaveModelSchemaV2';

import { getEditorialFindings } from './editorialReview';
import { getFigureKeys } from './figureNumbers';
import { resolveDashboardStyle } from './resolveStyle';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceInstanceSettings: jest.fn().mockResolvedValue(undefined),
}));

function load(spec: DashboardV2Spec) {
  const dto: DashboardWithAccessInfo<DashboardV2Spec> = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'v2',
    metadata: { name: 'report', namespace: 'default', resourceVersion: '1', creationTimestamp: '', annotations: {} },
    spec,
    access: { url: '/d/report', slug: 'report' },
  };
  return transformSaveModelSchemaV2ToScene(dto);
}

// The showcase dashboard is a realistic report: numbered sections, figures in a rail, margin notes.
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const rolloutSpec = rolloutFixture.spec as unknown as DashboardV2Spec;

describe('resolveDashboardStyle', () => {
  const dark = createTheme({ colors: { mode: 'dark' } });
  const light = createTheme({ colors: { mode: 'light' } });

  it('keeps the Grafana theme for a pack this version does not know', () => {
    expect(resolveDashboardStyle({ pack: 'from-a-newer-grafana' }, dark)).toBeUndefined();
  });

  it('falls back to the pack defaults when a saved palette or typography no longer exists', () => {
    const style = resolveDashboardStyle({ pack: 'newsroom', palette: 'gone', typography: 'gone' }, dark);

    expect(style?.palette.id).toBe('press');
    expect(style?.typography.id).toBe('broadsheet');
  });

  it('follows the host lighting mode with the same palette', () => {
    const inDark = resolveDashboardStyle({ pack: 'field-guide' }, dark);
    const inLight = resolveDashboardStyle({ pack: 'field-guide' }, light);

    expect(inDark?.mode).toBe('dark');
    expect(inLight?.mode).toBe('light');
    expect(inDark?.colors.bg).not.toBe(inLight?.colors.bg);
  });

  it('replaces only the accent when one is chosen', () => {
    const base = resolveDashboardStyle({ pack: 'keynote' }, dark)!;
    const accented = resolveDashboardStyle({ pack: 'keynote', accent: 'lime' }, dark)!;

    expect(accented.colors.accent).not.toBe(base.colors.accent);
    expect({ ...accented.colors, accent: base.colors.accent }).toEqual(base.colors);
  });
});

describe('report style in the save model', () => {
  it('round-trips the authored style and lede', () => {
    const saved = transformSceneToSaveModelSchemaV2(load(rolloutSpec));

    expect(saved.style).toEqual({ pack: 'field-guide' });
    expect(saved.lede).toBe(rolloutSpec.lede);
  });

  it('does not write style or lede into a dashboard that never had them', () => {
    const { style, lede, ...plain } = rolloutSpec;
    const saved = transformSceneToSaveModelSchemaV2(load(plain));

    expect(saved).not.toHaveProperty('style');
    expect(saved).not.toHaveProperty('lede');
  });
});

describe('getFigureKeys', () => {
  it('numbers titled panels across sections in reading order and skips untitled figures and notes', () => {
    const scene = load(rolloutSpec);
    const titles = getFigureKeys(scene).map(
      (key) => scene.state.body.getVizPanels().find((panel) => panel.state.key === key)?.state.title
    );

    expect(titles).toEqual([
      'Share of traffic served by v2',
      'Error rate, canary against stable',
      'p95 latency, canary against stable',
      'Promotion gates for the 75% step',
    ]);
  });
});

describe('getEditorialFindings', () => {
  it('has nothing to flag on a report that opens on its finding and uses figures', () => {
    expect(getEditorialFindings(load(rolloutSpec)).map((finding) => finding.id)).toEqual([]);
  });

  it('asks for a lede when report sections have none', () => {
    const { lede, ...withoutLede } = rolloutSpec;

    expect(getEditorialFindings(load(withoutLede)).map((finding) => finding.id)).toContain('lede-missing');
  });

  it('flags five stat tiles in a grid, but not the same panels set as figures', () => {
    const tiles = (presentation?: string) =>
      Object.fromEntries(
        [1, 2, 3, 4, 5].map((id) => [
          `tile-${id}`,
          {
            kind: 'Panel',
            spec: {
              ...rolloutSpec.elements['fig-weight'].spec,
              id: 100 + id,
              vizConfig: {
                kind: 'VizConfig',
                group: 'stat',
                version: '',
                spec: {
                  options: presentation ? { presentation } : {},
                  fieldConfig: { defaults: { unit: 'percent' }, overrides: [] },
                },
              },
            },
          },
        ])
      );
    const withTiles = (presentation?: string): DashboardV2Spec => ({
      ...rolloutSpec,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      elements: { ...rolloutSpec.elements, ...tiles(presentation) } as DashboardV2Spec['elements'],
      layout: {
        kind: 'RowsLayout',
        spec: {
          rows: [
            {
              kind: 'RowsLayoutRow',
              spec: {
                title: 'Five numbers',
                headerStyle: 'report',
                summary: 'The week in numbers.',
                layout: {
                  kind: 'AutoGridLayout',
                  spec: {
                    maxColumnCount: 5,
                    columnWidthMode: 'standard',
                    rowHeightMode: 'standard',
                    items: [1, 2, 3, 4, 5].map((id) => ({
                      kind: 'AutoGridLayoutItem',
                      spec: { element: { kind: 'ElementReference', name: `tile-${id}` } },
                    })),
                  },
                },
              },
            },
          ],
        },
      },
    });

    const ids = (spec: DashboardV2Spec) => getEditorialFindings(load(spec)).map((finding) => finding.id);

    expect(ids(withTiles()).some((id) => id.startsWith('kpi-wall'))).toBe(true);
    expect(ids(withTiles('figure')).some((id) => id.startsWith('kpi-wall'))).toBe(false);
  });
});
