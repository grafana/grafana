/**
 * A library panel keeps the element name its dashboard was saved under, end to end: v2 spec into a
 * scene, back out through the real serializer.
 *
 * The unit cover for this is `initializeElementMapping` in DashboardSceneSerializer.test.ts. This is
 * the round trip, because the map is only interesting for what serialization does with it, and the
 * failure was silent: a dashboard saved with `elements: { 'saved-view': ... }` came back with
 * `panel-<id>` instead, so the persisted key changed under a user who only opened and saved.
 */

import {
  type Spec as DashboardV2Spec,
  defaultSpec as defaultDashboardV2Spec,
  defaultLibraryPanelKind,
  defaultPanelSpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { type DashboardWithAccessInfo } from 'app/features/dashboard/api/types';

import { transformSaveModelSchemaV2ToScene } from './transformSaveModelSchemaV2ToScene';
import { transformSceneToSaveModelSchemaV2 } from './transformSceneToSaveModelSchemaV2';

/** Element names are deliberately not `panel-<id>`: the canonical name is what hides this bug. */
function dashboardWithLibraryPanel(): DashboardV2Spec {
  return {
    ...defaultDashboardV2Spec(),
    title: 'Checkout latency',
    elements: {
      'latency-panel': { kind: 'Panel', spec: { ...defaultPanelSpec(), id: 1, title: 'p99 latency' } },
      'saved-view': {
        ...defaultLibraryPanelKind(),
        spec: {
          ...defaultLibraryPanelKind().spec,
          id: 2,
          title: 'Checkout overview',
          libraryPanel: { uid: 'lib-uid-1', name: 'Checkout overview' },
        },
      },
    },
    layout: {
      kind: 'GridLayout',
      spec: {
        items: [
          {
            kind: 'GridLayoutItem',
            spec: { x: 0, y: 0, width: 12, height: 8, element: { kind: 'ElementReference', name: 'latency-panel' } },
          },
          {
            kind: 'GridLayoutItem',
            spec: { x: 0, y: 8, width: 12, height: 8, element: { kind: 'ElementReference', name: 'saved-view' } },
          },
        ],
      },
    },
  };
}

function sceneFrom(spec: DashboardV2Spec) {
  const dto = {
    kind: 'DashboardWithAccessInfo',
    apiVersion: 'dashboard.grafana.app/v2beta1',
    metadata: { name: 'dash-1', generation: 1, creationTimestamp: '2026-08-05T00:00:00Z', annotations: {} },
    access: { canEdit: true, canSave: true, canShare: true, canStar: true, canDelete: true, canAdmin: true },
    spec,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal resource envelope for the test
  } as unknown as DashboardWithAccessInfo<DashboardV2Spec>;

  // Deliberately not activated: serialization reads scene state, and activating would start the
  // library panel fetch and the annotation data layer, neither of which this is about.
  return transformSaveModelSchemaV2ToScene(dto);
}

function layoutReferences(spec: DashboardV2Spec): string[] {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the fixture is a grid layout
  const items = (spec.layout as { spec: { items: Array<{ spec: { element: { name: string } } }> } }).spec.items;
  return items.map((item) => item.spec.element.name);
}

describe('library panel element names', () => {
  it('survive a scene round trip', () => {
    const serialized = transformSceneToSaveModelSchemaV2(sceneFrom(dashboardWithLibraryPanel()));

    expect(Object.keys(serialized.elements).sort()).toEqual(['latency-panel', 'saved-view']);
    expect(serialized.elements['saved-view'].kind).toBe('LibraryPanel');
  });

  it('leave no layout reference pointing at a missing element', () => {
    const serialized = transformSceneToSaveModelSchemaV2(sceneFrom(dashboardWithLibraryPanel()));

    expect(layoutReferences(serialized)).toEqual(['latency-panel', 'saved-view']);
    for (const name of layoutReferences(serialized)) {
      expect(serialized.elements[name]).toBeDefined();
    }
  });
});
