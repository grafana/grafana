import { map } from 'rxjs';

import {
  ArrayVector,
  getDefaultTimeRange,
  LoadingState,
  standardTransformersRegistry,
  toDataFrame,
} from '@grafana/data';

import { SceneFlexLayout } from '../components';

import { SceneDataNode } from './SceneDataNode';
import { SceneDataTransformer } from './SceneDataTransformer';
import { SceneObjectBase } from './SceneObjectBase';
import { sceneGraph } from './sceneGraph';

class TestSceneObject extends SceneObjectBase<{}> {}
describe('SceneDataTransformer', () => {
  let transformerSpy1 = jest.fn();
  let transformerSpy2 = jest.fn();

  beforeEach(() => {
    standardTransformersRegistry.setInit(() => {
      return [
        {
          id: 'customTransformer1',
          editor: () => null,
          transformation: {
            id: 'customTransformer1',
            name: 'Custom Transformer',
            operator: (options) => (source) => {
              transformerSpy1(options);
              return source.pipe(
                map((data) => {
                  return data.map((frame) => {
                    return {
                      ...frame,
                      fields: frame.fields.map((field) => {
                        return {
                          ...field,
                          values: new ArrayVector(field.values.toArray().map((v) => v * 2)),
                        };
                      }),
                    };
                  });
                })
              );
            },
          },
          name: 'Custom Transformer',
        },
        {
          id: 'customTransformer2',
          editor: () => null,
          transformation: {
            id: 'customTransformer2',
            name: 'Custom Transformer2',
            operator: (options) => (source) => {
              transformerSpy2(options);
              return source.pipe(
                map((data) => {
                  return data.map((frame) => {
                    return {
                      ...frame,
                      fields: frame.fields.map((field) => {
                        return {
                          ...field,
                          values: new ArrayVector(field.values.toArray().map((v) => v * 3)),
                        };
                      }),
                    };
                  });
                })
              );
            },
          },
          name: 'Custom Transformer 2',
        },
      ];
    });
  });

  it('applies transformations to closest data node', () => {
    const sourceDataNode = new SceneDataNode({
      data: {
        state: LoadingState.Loading,
        timeRange: getDefaultTimeRange(),
        series: [
          toDataFrame([
            [100, 1],
            [200, 2],
            [300, 3],
          ]),
        ],
      },
    });

    const transformationNode = new SceneDataTransformer({
      transformations: [
        {
          id: 'customTransformer1',
          options: {
            option: 'value1',
          },
        },
        {
          id: 'customTransformer2',
          options: {
            option: 'value2',
          },
        },
      ],
    });

    const consumer = new TestSceneObject({
      $data: transformationNode,
    });

    // @ts-expect-error
    const scene = new SceneFlexLayout({
      $data: sourceDataNode,
      children: [consumer],
    });

    sourceDataNode.activate();
    transformationNode.activate();

    // Transforms initial data
    let data = sceneGraph.getData(consumer).state.data;
    expect(transformerSpy1).toHaveBeenCalledTimes(1);
    expect(transformerSpy1).toHaveBeenCalledWith({ option: 'value1' });
    expect(transformerSpy2).toHaveBeenCalledTimes(1);
    expect(transformerSpy2).toHaveBeenCalledWith({ option: 'value2' });

    expect(data?.series.length).toBe(1);
    expect(data?.series[0].fields).toHaveLength(2);
    expect(data?.series[0].fields[0].values.toArray()).toEqual([600, 1200, 1800]);
    expect(data?.series[0].fields[1].values.toArray()).toEqual([6, 12, 18]);

    sourceDataNode.setState({
      data: {
        state: LoadingState.Done,
        timeRange: getDefaultTimeRange(),
        series: [
          toDataFrame([
            [10, 10],
            [20, 20],
            [30, 30],
          ]),
        ],
      },
    });

    // Transforms updated data
    data = sceneGraph.getData(consumer).state.data;
    expect(transformerSpy1).toHaveBeenCalledTimes(2);
    expect(transformerSpy2).toHaveBeenCalledTimes(2);

    expect(data?.series[0].fields[0].values.toArray()).toEqual([60, 120, 180]);
    expect(data?.series[0].fields[1].values.toArray()).toEqual([60, 120, 180]);
  });
});
