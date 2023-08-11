import {
  DxfParser,
  ICircleEntity,
  IEllipseEntity,
  IEntity,
  ILayer,
  ILineEntity,
  ILwpolylineEntity,
  IPolylineEntity,
  IPointEntity,
  ITextEntity,
  IViewPort,
  IDxf,
} from 'dxf-parser';

import { ColorDimensionConfig } from '@grafana/schema';
import {
  Align,
  CanvasElementItem,
  CanvasElementOptions,
  canvasElementRegistry,
  EllipseConfig,
  EllipseData,
  HorizontalConstraint,
  LineConfig,
  LineData,
  TextConfig,
  TextData,
  VAlign,
  VerticalConstraint,
} from 'app/features/canvas';
import { ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { Scene } from 'app/features/canvas/runtime/scene';

const BOTTOM_LEFT_CONSTRAINT = {
  horizontal: HorizontalConstraint.Left,
  vertical: VerticalConstraint.Bottom,
};

const SCALE = 3;

const MIN_LWEIGHT = 25;

interface Ellipse {
  width: number;
  height: number;
  rotation: number;
  midPoint: Point;
}

interface Line {
  theta: number;
  length: number;
  midPoint: Point;
}

interface Point {
  x: number;
  y: number;
}

export async function handleDxfFile(file: File, canvasLayer: FrameState) {
  let fileText = await file.text();

  const parser = new DxfParser();
  const dxf = parser.parseSync(fileText);
  if (!dxf) {
    throw new Error('Failed to parse DXF file');
  }

  for (const element of canvasLayer.elements) {
    canvasLayer.elements = canvasLayer.elements.filter((e) => e !== element);
    fastUpdateConnectionsForSource(element, canvasLayer.scene);
    canvasLayer.scene.byName.delete(element.options.name);
  }

  addEntityLoop(dxf, canvasLayer);

  updateScene(canvasLayer, dxf.tables.viewPort.viewPorts[0]);
}

function addEntityLoop(dxf: IDxf, canvasLayer: FrameState) {
  const layerMap = new Map<string, IEntity[]>();
  const mapEntity = (entity: IEntity, name: string) => {
    if (!layerMap.has(name)) {
      layerMap.set(name, []);
    }
    layerMap.get(name)?.push(entity);
  };

  for (const entity of dxf.entities) {
    if (isNaN(+entity.layer)) {
      mapEntity(entity, entity.layer);
    } else {
      addEntity(entity, dxf.tables.layer.layers[entity.layer], canvasLayer);
    }
  }

  for (const [layerName, entities] of layerMap.entries()) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      addEntity(entity, dxf.tables.layer.layers[entity.layer], canvasLayer, `${layerName}${i + 1}-${entity.type}`);
    }
  }
}

function updateScene(canvasLayer: FrameState, viewport: IViewPort) {
  const options = canvasLayer.options;
  options.background = {
    color: {
      fixed: hexFromColorRepr(viewport.ambientColor),
    },
  };

  const scene = canvasLayer.scene;

  canvasLayer.onChange(options);
  canvasLayer.updateData(scene.context);

  scene.save();
  canvasLayer.reinitializeMoveable();
}

function addEntity(entity: IEntity, entityLayer: ILayer, canvasLayer: FrameState, name?: string) {
  try {
    if (isLineEntity(entity)) {
      addLineElement(entity, entityLayer, canvasLayer, name);
    } else if (isILwpolylineEntity(entity)) {
      addLwPolylineElement(entity, entityLayer, canvasLayer, name);
    } else if (isCircleEntity(entity)) {
      addCircleElement(entity, entityLayer, canvasLayer, name);
    } else if (isEllipseEntity(entity)) {
      addEllipseElement(entity, entityLayer, canvasLayer, name);
    } else if (isPointEntity(entity)) {
      addPointElement(entity, entityLayer, canvasLayer, name);
    } else if (isTextEntity(entity)) {
      addTextElement(entity, entityLayer, canvasLayer, name);
    } else if (isPolyLineEntity(entity) && isSupportedPolyLineEntity(entity)) {
      add2dPolylineElement(entity, entityLayer, canvasLayer, name);
    } else {
      console.warn('unhandled entity type', entity.type);
    }
  } catch (error) {
    console.warn('failed to add entity', entity, error);
  }
}

function isTextEntity(entity: IEntity): entity is ITextEntity {
  return entity.type === 'TEXT';
}

function isLineEntity(entity: IEntity): entity is ILineEntity {
  return entity.type === 'LINE';
}

function isILwpolylineEntity(entity: IEntity): entity is ILwpolylineEntity {
  return entity.type === 'LWPOLYLINE';
}

function isPolyLineEntity(entity: IEntity): entity is IPolylineEntity {
  return entity.type === 'POLYLINE';
}

function isSupportedPolyLineEntity(entity: IPolylineEntity): boolean {
  return (
    !entity.includesCurveFitVertices &&
    !entity.includesSplineFitVertices &&
    !entity.is3dPolyline &&
    !entity.is3dPolygonMesh &&
    !entity.isPolyfaceMesh
  );
}

function isCircleEntity(entity: IEntity): entity is ICircleEntity {
  return entity.type === 'CIRCLE';
}

function isEllipseEntity(entity: IEntity): entity is IEllipseEntity {
  return entity.type === 'ELLIPSE';
}

function isPointEntity(entity: IEntity): entity is IPointEntity {
  return entity.type === 'POINT';
}

function addTextElement(entity: ITextEntity, entityLayer: ILayer, canvasLayer: FrameState, name: string | undefined) {
  const newTextItem: CanvasElementItem<TextConfig, TextData> = canvasElementRegistry.get('text');

  let newElementOptions: CanvasElementOptions = {
    ...newTextItem.getNewOptions(),
    type: newTextItem.id,
    name: name ? name : '',
    constraint: BOTTOM_LEFT_CONSTRAINT,
    placement: {
      bottom: entity.startPoint.y * SCALE,
      left: entity.startPoint.x * SCALE,
      rotation: -entity.rotation,
      height: entity.textHeight * SCALE,
      width: entity.textHeight * entity.text.length * SCALE,
    },
    config: {
      text: { fixed: entity.text },
      size: entity.textHeight * SCALE,
      color: {
        fixed: hexFromColorRepr(entity.color, entityLayer.color),
      },
      align: Align.Left,
      valign: VAlign.Bottom,
    },
  };

  pushElement(new ElementState(newTextItem, newElementOptions, canvasLayer), canvasLayer);
}

function lineFromVertices(vertices: Array<{ x: number; y: number }>): Line {
  const dy = vertices[1].y - vertices[0].y;
  const dx = vertices[1].x - vertices[0].x;

  const theta = (Math.atan2(dy, dx) * 180) / Math.PI;
  const length = Math.hypot(dx, dy);

  return {
    theta,
    length,
    midPoint: {
      x: (vertices[0].x + vertices[1].x) / 2,
      y: (vertices[0].y + vertices[1].y) / 2,
    },
  };
}

function addLineElement(entity: ILineEntity, entityLayer: ILayer, canvasLayer: FrameState, name: string | undefined) {
  pushElement(
    newLineElementState(
      lineFromVertices(entity.vertices),
      entity.lineweight,
      { fixed: hexFromColorRepr(entity.color, entityLayer.color) },
      canvasLayer,
      name
    ),
    canvasLayer
  );
}

function addLwPolylineElement(
  entity: ILwpolylineEntity,
  entityLayer: ILayer,
  canvasLayer: FrameState,
  name: string | undefined
) {
  for (let i = 0; i < entity.vertices.length - 1; i++) {
    let lineName = name;
    if (lineName) {
      lineName = `${lineName}-L${i + 1}`;
    }

    pushElement(
      newLineElementState(
        lineFromVertices(entity.vertices.slice(i, i + 2)),
        entity.lineweight,
        { fixed: hexFromColorRepr(entity.color, entityLayer.color) },
        canvasLayer,
        lineName
      ),
      canvasLayer
    );
  }
}

function add2dPolylineElement(
  entity: IPolylineEntity,
  entityLayer: ILayer,
  canvasLayer: FrameState,
  name: string | undefined
) {
  let bound = entity.vertices.length - 1;
  if (entity.shape) {
    bound++;
  }

  for (let i = 0; i < bound; i++) {
    let vertices =
      i + 1 === entity.vertices.length && entity.shape
        ? [entity.vertices[entity.vertices.length - 1], entity.vertices[0]]
        : entity.vertices.slice(i, i + 2);

    let lineName = name;
    if (lineName) {
      lineName = `${lineName}-L${i + 1}`;
    }

    pushElement(
      newLineElementState(
        lineFromVertices(vertices),
        entity.lineweight,
        { fixed: hexFromColorRepr(entity.color, entityLayer.color) },
        canvasLayer,
        lineName
      ),
      canvasLayer
    );
  }
}

function newLineElementState(
  line: Line,
  lineWeight: number | undefined,
  color: ColorDimensionConfig,
  canvasLayer: FrameState,
  name: string | undefined
): ElementState {
  let weight = pixelsFromLineWeight(lineWeight);

  const newLineItem: CanvasElementItem<LineConfig, LineData> = canvasElementRegistry.get('line');
  let newElementOptions: CanvasElementOptions = {
    ...newLineItem.getNewOptions(),
    type: newLineItem.id,
    name: name ? name : '',
    constraint: BOTTOM_LEFT_CONSTRAINT,
    placement: {
      bottom: (line.midPoint.y - weight / 2) * SCALE,
      left: (line.midPoint.x - line.length / 2) * SCALE,
      height: weight,
      width: line.length * SCALE,
      rotation: -line.theta,
    },
    config: {
      width: weight,
      color: color,
    },
  };

  return new ElementState(newLineItem, newElementOptions, canvasLayer);
}

function ellipseFromCadEllipse(entity: IEllipseEntity): Ellipse {
  const dx = entity.majorAxisEndPoint.x;
  const dy = entity.majorAxisEndPoint.y;

  const theta = (Math.atan2(dy, dx) * 180) / Math.PI;
  const width = Math.hypot(dx, dy) * 2;
  const height = width * entity.axisRatio;

  return {
    width,
    height,
    rotation: theta,
    midPoint: entity.center,
  };
}

function ellipseFromCadCircle(entity: ICircleEntity): Ellipse {
  return {
    width: entity.radius * 2,
    height: entity.radius * 2,
    rotation: 0,
    midPoint: entity.center,
  };
}

function ellipseFromCadPoint(entity: IPointEntity): Ellipse {
  return {
    width: 1,
    height: 1,
    rotation: 0,
    midPoint: entity.position,
  };
}

function addEllipseElement(
  entity: IEllipseEntity,
  entityLayer: ILayer,
  canvasLayer: FrameState,
  name: string | undefined
) {
  pushElement(
    newEllipseElement(
      ellipseFromCadEllipse(entity),
      { fixed: hexFromColorRepr(entity.color, entityLayer.color) },
      entity.lineweight,
      canvasLayer,
      name
    ),
    canvasLayer
  );
}

function addCircleElement(
  entity: ICircleEntity,
  entityLayer: ILayer,
  canvasLayer: FrameState,
  name: string | undefined
) {
  pushElement(
    newEllipseElement(
      ellipseFromCadCircle(entity),
      { fixed: hexFromColorRepr(entity.color, entityLayer.color) },
      entity.lineweight,
      canvasLayer,
      name
    ),
    canvasLayer
  );
}

function addPointElement(entity: IPointEntity, entityLayer: ILayer, canvasLayer: FrameState, name: string | undefined) {
  pushElement(
    newEllipseElement(
      ellipseFromCadPoint(entity),
      { fixed: hexFromColorRepr(entity.color, entityLayer.color) },
      entity.lineweight,
      canvasLayer,
      name,
      true
    ),
    canvasLayer
  );
}

function newEllipseElement(
  ellipse: Ellipse,
  color: ColorDimensionConfig,
  lineWeight: number | undefined,
  canvasLayer: FrameState,
  name: string | undefined,
  isPoint?: boolean
) {
  let height = ellipse.height;
  let width = ellipse.width;
  if (!isPoint) {
    height = height * SCALE;
    width = width * SCALE;
  }

  const newEllipseItem: CanvasElementItem<EllipseConfig, EllipseData> = canvasElementRegistry.get('ellipse');
  let newElementOptions: CanvasElementOptions = {
    ...newEllipseItem.getNewOptions(),
    type: newEllipseItem.id,
    name: name ? name : '',
    constraint: BOTTOM_LEFT_CONSTRAINT,
    placement: {
      bottom: (ellipse.midPoint.y - ellipse.height / 2) * SCALE,
      left: (ellipse.midPoint.x - ellipse.width / 2) * SCALE,
      height,
      width,
      rotation: -ellipse.rotation,
    },
    config: {
      backgroundColor: {
        fixed: 'transparent',
      },
      borderColor: color,
      borderWidth: pixelsFromLineWeight(lineWeight),
    },
  };

  return new ElementState(newEllipseItem, newElementOptions, canvasLayer);
}

function hexFromColorRepr(color: number | undefined, layerColor?: number): string {
  let hexColor: string;
  let colorRepr = color ?? layerColor ?? undefined;

  if (colorRepr) {
    hexColor = colorRepr.toString(16);
  } else {
    hexColor = 'ffffff';
  }

  return '#' + hexColor.padStart(6, '0');
}

function pixelsFromLineWeight(lineWeight: number | undefined): number {
  let weight = MIN_LWEIGHT;
  if (lineWeight !== undefined && lineWeight !== 0) {
    // clamp to min
    if (lineWeight > weight) {
      weight = lineWeight;
    }
  }
  return weight / 100; // weights are in 100ths of a mm
}

function pushElement(element: ElementState, canvasLayer: FrameState) {
  canvasLayer.elements.push(element);
  canvasLayer.scene.byName.set(element.options.name, element);
}

function fastUpdateConnectionsForSource(element: ElementState, scene: Scene) {
  const targetConnections = scene.connections.state.filter((connection) => connection.target === element);
  for (const connection of targetConnections) {
    const sourceConnections = connection.source.options.connections?.splice(0) ?? [];
    const connections = sourceConnections.filter((con) => con.targetName !== element.getName());
    connection.source.onChange({ ...connection.source.options, connections });
  }
}
