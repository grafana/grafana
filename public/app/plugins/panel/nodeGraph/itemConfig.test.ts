import {
  type FieldConfigSource,
  FieldType,
  createDataFrame,
  createTheme,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { getAllOptionEditors, getAllStandardFieldConfigs } from 'app/core/components/OptionsUI/registry';

import { getEdgeItems, getNodeItems, resolveItemStyles } from './itemConfig';

standardEditorsRegistry.setInit(getAllOptionEditors);
standardFieldConfigEditorRegistry.setInit(getAllStandardFieldConfigs);

const nodesFrame = createDataFrame({
  name: 'nodes',
  fields: [
    { name: 'id', type: FieldType.string, values: ['gateway', 'eu-west'] },
    { name: 'title', type: FieldType.string, values: ['Gateway', 'EU West'] },
    { name: 'subTitle', type: FieldType.string, values: ['edge', 'region'] },
  ],
});

const edgesFrame = createDataFrame({
  name: 'edges',
  fields: [
    { name: 'id', type: FieldType.string, values: ['e1', 'e2'] },
    { name: 'source', type: FieldType.string, values: ['gateway', 'eu-west'] },
    { name: 'target', type: FieldType.string, values: ['eu-west', 'gateway'] },
  ],
});

const data = [nodesFrame, edgesFrame];

// Node graph marks come straight from the frames, so the context is unused here
const context = {
  fieldConfig: { defaults: {}, overrides: [] },
  options: {},
  replaceVariables: (v: string) => v,
  theme: createTheme(),
};

describe('getNodeItems', () => {
  it('labels nodes by title and describes them by subtitle', () => {
    expect(getNodeItems(data, context)).toEqual([
      { id: 'gateway', label: 'Gateway', description: 'edge' },
      { id: 'eu-west', label: 'EU West', description: 'region' },
    ]);
  });

  it('returns nothing when there is no node frame', () => {
    expect(getNodeItems([edgesFrame], context)).toEqual([]);
  });
});

describe('getEdgeItems', () => {
  it('labels edges by the source → target pair', () => {
    expect(getEdgeItems(data, context)).toEqual([
      { id: 'e1', label: 'gateway → eu-west' },
      { id: 'e2', label: 'eu-west → gateway' },
    ]);
  });
});

describe('resolveItemStyles', () => {
  it('returns empty maps when the panel has no rules', () => {
    const { nodeStyles, edgeStyles } = resolveItemStyles({ defaults: {}, overrides: [] }, data, context);

    expect(nodeStyles.size).toBe(0);
    expect(edgeStyles.size).toBe(0);
  });

  it('resolves node and edge rules into their own maps', () => {
    const fieldConfig: FieldConfigSource = {
      defaults: {},
      overrides: [],
      itemOverrides: [
        {
          matcher: { id: 'byItemIds', kind: 'node', options: ['gateway'] },
          properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
        },
        {
          matcher: { id: 'byItemRegexp', kind: 'edge', options: '/^gateway/' },
          properties: [{ id: 'custom.thickness', value: 3 }],
        },
      ],
    };

    const { nodeStyles, edgeStyles } = resolveItemStyles(fieldConfig, data, context);

    expect([...nodeStyles.keys()]).toEqual(['gateway']);
    expect(nodeStyles.get('gateway')?.color).toEqual({ mode: 'fixed', fixedColor: 'red' });

    // Only e1 is labelled "gateway → eu-west"
    expect([...edgeStyles.keys()]).toEqual(['e1']);
    expect(edgeStyles.get('e1')?.custom?.thickness).toBe(3);
  });

  it('keeps a rule for one kind out of the other kind map', () => {
    const { nodeStyles, edgeStyles } = resolveItemStyles(
      {
        defaults: {},
        overrides: [],
        itemOverrides: [
          {
            matcher: { id: 'byItemIds', kind: 'node', options: ['gateway'] },
            properties: [{ id: 'color', value: { mode: 'fixed', fixedColor: 'red' } }],
          },
        ],
      },
      data,
      context
    );

    expect(nodeStyles.size).toBe(1);
    expect(edgeStyles.size).toBe(0);
  });
});
