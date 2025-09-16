import {
  SceneDataNode,
  SceneDataTransformer,
  SceneDeactivationHandler,
  SceneFlexItem,
  SceneFlexLayout,
  sceneGraph,
  SceneObject,
  SceneObjectBase,
  SceneVariable,
  SceneVariableSet,
  TestVariable,
} from '@grafana/scenes';
import { DataTransformerConfig, LoadingState } from '@grafana/schema';

import { toDataFrame } from '../../dataframe/processDataFrame';
import { DataFrame, FieldType } from '../../types/dataFrame';
import { getDefaultTimeRange } from '../../types/time';
import { mockTransformationsRegistry } from '../../utils/tests/mockTransformationsRegistry';
import { transformDataFrame } from '../transformDataFrame';

import { filterFieldsTransformer } from './filter';
import { filterFieldsByNameTransformer } from './filterByName';
import { DataTransformerID } from './ids';

export const seriesWithNamesToMatch = toDataFrame({
  fields: [
    { name: 'startsWithA', type: FieldType.time, values: [1000, 2000] },
    { name: 'B', type: FieldType.boolean, values: [true, false] },
    { name: 'startsWithC', type: FieldType.string, values: ['a', 'b'] },
    { name: 'D', type: FieldType.number, values: [1, 2] },
  ],
});

describe('filterByName transformer', () => {
  beforeAll(() => {
    mockTransformationsRegistry([filterFieldsByNameTransformer, filterFieldsTransformer]);
  });

  it('returns original series if no options provided', async () => {
    const cfg = {
      id: DataTransformerID.filterFields,
      options: {},
    };

    await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
      const data = received[0];
      const filtered = data[0];
      expect(filtered.fields.length).toBe(4);
    });
  });

  describe('respects', () => {
    it('inclusion by pattern', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            pattern: '/^(startsWith)/',
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('startsWithA');
      });
    });

    it('exclusion by pattern', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: {
            pattern: '/^(startsWith)/',
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('inclusion and exclusion by pattern', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: { pattern: '/^(startsWith)/' },
          include: { pattern: '/^(B)$/' },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(1);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('inclusion by names', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            names: ['startsWithA', 'startsWithC'],
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('startsWithA');
      });
    });

    it('exclusion by names', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: {
            names: ['startsWithA', 'startsWithC'],
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('inclusion and exclusion by names', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: { names: ['startsWithA', 'startsWithC'] },
          include: { names: ['B'] },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(1);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('inclusion by both', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            pattern: '/^(startsWith)/',
            names: ['startsWithA'],
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('startsWithA');
      });
    });

    it('exclusion by both', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: {
            pattern: '/^(startsWith)/',
            names: ['startsWithA'],
          },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(2);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('inclusion and exclusion by both', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          exclude: { names: ['startsWithA', 'startsWithC'] },
          include: { pattern: '/^(B)$/' },
        },
      };

      await expect(transformDataFrame([cfg], [seriesWithNamesToMatch])).toEmitValuesWith((received) => {
        const data = received[0];
        const filtered = data[0];
        expect(filtered.fields.length).toBe(1);
        expect(filtered.fields[0].name).toBe('B');
      });
    });

    it('it can use a variable with multiple comma separated', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            variable: '$var',
          },
          byVariable: true,
        },
      };

      const data = setupTransformationScene(seriesWithNamesToMatch, cfg, [
        new TestVariable({ name: 'var', value: 'B,D' }),
      ]);
      const filtered = data[0];
      expect(filtered.fields.length).toBe(2);
      expect(filtered.fields[0].name).toBe('B');
      expect(filtered.fields[1].name).toBe('D');
    });

    it('it can use a variable with multiple comma separated values in {}', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            variable: '$var',
          },
          byVariable: true,
        },
      };

      const data = setupTransformationScene(seriesWithNamesToMatch, cfg, [
        new TestVariable({ name: 'var', value: 'B,D' }),
      ]);

      const filtered = data[0];
      expect(filtered.fields.length).toBe(2);
      expect(filtered.fields[0].name).toBe('B');
      expect(filtered.fields[1].name).toBe('D');
    });

    it('uses template variable substitution', async () => {
      const cfg = {
        id: DataTransformerID.filterFieldsByName,
        options: {
          include: {
            pattern: '/^$var/',
          },
        },
      };

      const data = setupTransformationScene(seriesWithNamesToMatch, cfg, [
        new TestVariable({ name: 'var', value: 'startsWith' }),
      ]);

      const filtered = data[0];
      expect(filtered.fields.length).toBe(2);
      expect(filtered.fields[0].name).toBe('startsWithA');
    });
  });
});

function activateFullSceneTree(scene: SceneObject): SceneDeactivationHandler {
  const deactivationHandlers: SceneDeactivationHandler[] = [];

  // Important that variables are activated before other children
  if (scene.state.$variables) {
    deactivationHandlers.push(activateFullSceneTree(scene.state.$variables));
  }

  scene.forEachChild((child) => {
    // For query runners which by default use the container width for maxDataPoints calculation we are setting a width.
    // In real life this is done by the React component when VizPanel is rendered.
    if ('setContainerWidth' in child) {
      // @ts-expect-error
      child.setContainerWidth(500);
    }
    deactivationHandlers.push(activateFullSceneTree(child));
  });

  deactivationHandlers.push(scene.activate());

  return () => {
    for (const handler of deactivationHandlers) {
      handler();
    }
  };
}

export function setupTransformationScene(
  inputData: DataFrame,
  cfg: DataTransformerConfig,
  variables: SceneVariable[]
): DataFrame[] {
  class TestSceneObject extends SceneObjectBase<{}> {}
  const dataNode = new SceneDataNode({
    data: {
      state: LoadingState.Loading,
      timeRange: getDefaultTimeRange(),
      series: [inputData],
    },
  });

  const transformationNode = new SceneDataTransformer({
    transformations: [cfg],
  });

  const consumer = new TestSceneObject({
    $data: transformationNode,
  });

  const scene = new SceneFlexLayout({
    $data: dataNode,
    $variables: new SceneVariableSet({ variables }),
    children: [new SceneFlexItem({ body: consumer })],
  });

  activateFullSceneTree(scene);

  return sceneGraph.getData(consumer).state.data?.series!;
}
