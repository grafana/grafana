import { isEqual } from 'lodash';
import { NestedScene } from '../components/NestedScene';
import { Scene } from '../components/Scene';
import { SceneFlexChild, SceneFlexLayout } from '../components/SceneFlexLayout';
import { flattenSceneNodes } from '../components/SceneInspectGraph';
import { SceneToolbar } from '../components/SceneToolbar';
import { VizPanel } from '../components/VizPanel';
import { SceneEditManager } from '../editor/SceneEditManager';
import { SceneDataProviderNode } from './SceneDataProviderNode';
import { SceneTimeRange } from './SceneTimeRange';
import { isDataNode, isLayoutNode, isParametrizedState } from './typeguards';
import { SceneLayoutState, SceneObject, SceneParametrizedState } from './types';

// TODO: below is just a base types for serialized model
type SerializedNode<T extends Record<string, any> = {}> = {
  key: string;
  type: string; // needs to be more pricese indicating available scene nodes
  inputParams?: Record<string, string>;
  children?: any[];
} & T;

type SerializedLayout = Record<string, SerializedNode | SerializedScene> & { root: SerializedNode[] };

type SerializedScene = {
  layout: SerializedLayout;
  inputs: any[];
  data: any;
};

export function serializeInputParams(inputs: Record<string, SceneObject>) {
  const serializedInputParams: Record<string, { $ref: string }> = {};

  for (const [key, input] of Object.entries(inputs)) {
    serializedInputParams[key] = { $ref: input.state.key! };
  }

  return serializedInputParams;
}

export function serializeLayout(node: SceneObject, isNested = false) {
  if (node instanceof Scene || isNested) {
    return {
      layout: (node as SceneObject<SceneLayoutState>).state.children.map((child) => serializeLayout(child)),
    };
  }

  // const serializedInputParams = isParametrizedState(node.state)
  //   ? serializeInputParams(node.state.inputParams)
  //   : undefined;

  if (node instanceof NestedScene) {
    return {
      $ref: node.state.key,
      type: node.constructor.name,
    };
  }

  if (isDataNode(node)) {
    return {
      $ref: node.state.key,
    };
  }

  if (isLayoutNode(node) && node.toJSON) {
    if (node.state.children) {
      return {
        ...serializeNode(node),
        children: (node as SceneObject<SceneLayoutState>).state.children.map((child) => serializeLayout(child)),
      };
    }

    return serializeNode(node);
    // {
    //   ...node.toJSON(),
    //   key: node.state.key,
    //   type: node.constructor.name,
    //   inputParams: serializedInputParams,
    // };
  }
}

export function serializeNode(node: SceneObject) {
  const serializedInputParams = isParametrizedState(node.state)
    ? serializeInputParams(node.state.inputParams)
    : undefined;

  const json = node.toJSON ? node.toJSON() : {};

  return {
    ...json,
    key: node.state.key,
    inputParams: { ...serializedInputParams },
    type: node.constructor.name,
  };
}

// TODO: types for serialized Scene
export function serializeScene(scene: Scene | NestedScene, isNested = false, hoistDataNodes = false): any {
  const children = Array.from(flattenSceneNodes(scene.state.children), ([_, v]) => v);
  const dataNodesIdxs: number[] = [];
  const dataNodesMap: Map<string, SerializedNode<any>> = new Map();

  const nestedScenesIdxs: number[] = [];

  children.forEach((child, idx) => {
    if (isDataNode(child)) {
      dataNodesIdxs.push(idx);
    } else if (child instanceof NestedScene) {
      nestedScenesIdxs.push(idx);
    }
  });

  const nestedScenes: Record<string, SerializedScene> = nestedScenesIdxs.reduce((acc, idx) => {
    return {
      ...acc,
      [children[idx].state.key!]: (children[idx] as NestedScene).toJSON(),
    };
  }, {});

  dataNodesIdxs.forEach((idx) => {
    const child = children[idx];
    if (child.toJSON) {
      dataNodesMap.set(child.state.key!, serializeNode(child));
    }
  });

  // To avoid data nodes duplication the nested scene inputs can be hoisted to the top level
  if (hoistDataNodes) {
    // iterate over nestedScenes and hoist data nodes to the top level
    for (const [, nestedScene] of Object.entries(nestedScenes)) {
      for (let idx = 0; idx < nestedScene.inputs.length; idx++) {
        const nestedDataNode = nestedScene.inputs[idx];
        const dataNode = dataNodesMap.get(nestedDataNode.key);
        if (dataNode) {
          if (nestedDataNode && isEqual(dataNode, nestedDataNode)) {
            nestedScene.inputs[idx] = { $ref: dataNode.key };
          }
        }
      }
    }
  }

  return {
    key: scene.state.key,
    title: scene.state.title,
    data: 'TODO: serialize Scene data?',
    inputs: Array.from(dataNodesMap.values()),
    layout: {
      root: serializeLayout(scene, isNested).layout,
      ...nestedScenes,
    },
  };
}

export function isSerializedScene(node: object): node is SerializedScene {
  return Object.prototype.hasOwnProperty.call(node, 'layout') && Object.prototype.hasOwnProperty.call(node, 'inputs');
}

export function sceneFromJSON(
  model: SerializedScene,
  dataNodesMap = new Map<string, SceneObject>(),
  nestedScenesMap = new Map<string, SceneObject>(),
  isNested = false
) {
  // map collecting information about what nodes depend on a given input param
  // map key = input param key, map values = nodes that depend on that input param [name of the param, node key]
  const inputParamsDependencies = new Map<string, Array<[string, string]>>();

  // build data nodes since layout may depend on those, some data
  model.inputs.forEach((input) => {
    if (!Object.prototype.hasOwnProperty.call(input, '$ref')) {
      // TODO: replace switch with some kind of nodes registry
      switch (input.type) {
        case 'SceneTimeRange':
          dataNodesMap.set(input.key, new SceneTimeRange(input));
          break;
        case 'SceneDataProviderNode':
          dataNodesMap.set(input.key, new SceneDataProviderNode(input));
          break;
        default:
          throw new Error(`Unknown input ${input.type}`);
      }

      if (input.inputParams) {
        for (const [inputParamName, paramKey] of Object.entries(input.inputParams)) {
          inputParamsDependencies.set(paramKey.$ref as string, [
            ...(inputParamsDependencies.get(paramKey.$ref as string) || []),
            [inputParamName, input.key],
          ]);
        }
      }
    }
  });

  // hookup cross dependencies for data
  for (const [source, dependencies] of inputParamsDependencies) {
    const sourceNode = dataNodesMap.get(source);
    for (const [inputParamName, target] of dependencies) {
      const targetNode = dataNodesMap.get(target);
      if (sourceNode && targetNode) {
        (targetNode.state as SceneParametrizedState<any>).inputParams[inputParamName] = sourceNode;
      }
    }
  }

  // iterate over model.layout
  for (const [key, node] of Object.entries(model.layout)) {
    if (key === 'root') {
      continue;
    } else {
      if (isSerializedScene(node)) {
        nestedScenesMap.set(key, sceneFromJSON(node, dataNodesMap, nestedScenesMap, true));
      }
    }
  }

  const children = model.layout.root ? buildSceneChildren(model.layout.root, dataNodesMap, nestedScenesMap) : [];

  if (isNested) {
    return new NestedScene({
      key: model.key,
      title: model.title,
      children,
      canCollapse: model.canCollapse,
      canRemove: model.canRemove,
      actions: buildSceneChildren(model.actions, dataNodesMap, nestedScenesMap),
    });
  } else {
    const s = new Scene({
      key: model.key,
      title: model.title,
      children,
      $editor: new SceneEditManager({}),
    });
    console.log(s);
    return s;
  }
}

// Builds a scene from a layout
function buildSceneChildren(
  children: any[],
  dataDependencies: Map<string, SceneObject>,
  nestedScenes: Map<string, SceneObject>
) {
  const sceneChildren: SceneObject[] = [];

  children.forEach((child) => {
    let ctor = null;
    let childrenNodes: any[] = [];
    let inputParams: Record<string, SceneObject> = {};

    // TODO: this heuristic is funky, need to figure sth out that would not depend on type being present or not
    // sth more explicit for nested scenes I think
    if (child.$ref && child.type) {
      sceneChildren.push(nestedScenes.get(child.$ref)!);
    } else if (!child.type && child.$ref) {
      // TODO: same here as above. This is
      sceneChildren.push(dataDependencies.get(child.$ref)!);
    } else {
      // TODO: replace switch with some kind of node types registry
      switch (child.type) {
        case 'SceneFlexLayout':
          ctor = SceneFlexLayout;
          break;
        case 'SceneFlexChild':
          ctor = SceneFlexChild;
          break;
        case 'VizPanel':
          ctor = VizPanel;
          break;
        case 'SceneTimeRange':
          debugger;
          ctor = SceneTimeRange;
          break;
        case 'SceneToolbar':
          ctor = SceneToolbar;
          break;
        default:
          console.error('Unknown child type', child.type);
      }

      if (!ctor) {
        throw new Error(`Unknown child type ${child.type}`);
      }

      if (child.children) {
        childrenNodes = buildSceneChildren(child.children, dataDependencies, nestedScenes);
      }

      if (child.inputParams) {
        for (const [inputParamName, paramRef] of Object.entries(child.inputParams)) {
          const paramNode = dataDependencies.get(paramRef.$ref as string);
          if (paramNode) {
            inputParams[inputParamName] = paramNode;
          }
        }
      }
      sceneChildren.push(
        new ctor({
          ...child,
          inputParams,
          children: childrenNodes,
        })
      );
    }
  });

  return sceneChildren;
}
