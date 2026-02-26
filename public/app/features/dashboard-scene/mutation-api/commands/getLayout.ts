/**
 * GET_LAYOUT command
 *
 * Returns the dashboard's v2beta1 layout tree (with path annotations on rows/tabs)
 * and a trimmed elements map (title, description, vizConfig.group only).
 */

import { z } from 'zod';

import type { Element, PanelKind } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import { getElements } from '../../serialization/layoutSerializers/utils';

import { payloads } from './schemas';
import { requiresNewDashboardLayoutsReadOnly, type MutationCommand } from './types';

export const getLayoutPayloadSchema = payloads.getLayout;

export type GetLayoutPayload = z.infer<typeof getLayoutPayloadSchema>;

interface TrimmedPanelKind {
  kind: 'Panel';
  spec: {
    title: string;
    description: string;
    vizConfig: {
      kind: 'VizConfig';
      group: string;
    };
  };
}

interface TrimmedLibraryPanelKind {
  kind: 'LibraryPanel';
  spec: {
    title: string;
    libraryPanel: { uid: string; name: string };
  };
}

type TrimmedElement = TrimmedPanelKind | TrimmedLibraryPanelKind;

function isPanelKind(element: Element): element is PanelKind {
  return element.kind === 'Panel';
}

function trimElement(element: Element): TrimmedElement {
  if (isPanelKind(element)) {
    return {
      kind: 'Panel',
      spec: {
        title: element.spec.title,
        description: element.spec.description,
        vizConfig: {
          kind: 'VizConfig',
          group: element.spec.vizConfig.group,
        },
      },
    };
  }
  // LibraryPanelKind
  return {
    kind: 'LibraryPanel',
    spec: {
      title: element.spec.title,
      libraryPanel: element.spec.libraryPanel,
    },
  };
}

function trimElements(elements: Record<string, Element>): Record<string, TrimmedElement> {
  const trimmed: Record<string, TrimmedElement> = {};
  for (const [key, element] of Object.entries(elements)) {
    trimmed[key] = trimElement(element);
  }
  return trimmed;
}

/**
 * Walk the serialized layout tree and inject `path` strings on RowsLayoutRow and TabsLayoutTab nodes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- walking an untyped serialized tree
function injectPaths(layout: any, prefix = ''): void {
  if (!layout || !layout.kind) {
    return;
  }

  if (layout.kind === 'RowsLayout' && layout.spec?.rows) {
    for (let i = 0; i < layout.spec.rows.length; i++) {
      const row = layout.spec.rows[i];
      const rowPath = `${prefix}/rows/${i}`;
      row.path = rowPath;
      if (row.spec?.layout) {
        injectPaths(row.spec.layout, rowPath);
      }
    }
  } else if (layout.kind === 'TabsLayout' && layout.spec?.tabs) {
    for (let i = 0; i < layout.spec.tabs.length; i++) {
      const tab = layout.spec.tabs[i];
      const tabPath = `${prefix}/tabs/${i}`;
      tab.path = tabPath;
      if (tab.spec?.layout) {
        injectPaths(tab.spec.layout, tabPath);
      }
    }
  }
}

export const getLayoutCommand: MutationCommand<GetLayoutPayload> = {
  name: 'GET_LAYOUT',
  description: payloads.getLayout.description ?? '',

  payloadSchema: payloads.getLayout,
  permission: requiresNewDashboardLayoutsReadOnly,
  readOnly: true,

  handler: async (_payload, context) => {
    const { scene } = context;

    try {
      const body = scene.state.body;

      // Deep-clone so injectPaths does not mutate the serializer's cached objects
      const layout = structuredClone(body.serialize());

      // Inject path annotations on rows and tabs
      injectPaths(layout);

      const fullElements = getElements(body, scene);
      const elements = trimElements(fullElements);

      return {
        success: true,
        data: { layout, elements },
        changes: [],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
