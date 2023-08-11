import {
  DxfParser,
  ICircleEntity,
  IEllipseEntity,
  IEntity,
  ILayer,
  ILayersTable,
  ILineEntity,
  ILwpolylineEntity,
  IPointEntity,
  ITextEntity,
  IViewPort,
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

import { LayerActionID } from '../../types';

const BOTTOM_LEFT_CONSTRAINT = {
  horizontal: HorizontalConstraint.Left,
  vertical: VerticalConstraint.Bottom,
};

const TEMP_MULTIPLIER = 15;

const DEFAULT_LWEIGHT = 25;

interface Ellipse {
  width: number;
  height: number;
  rotation?: number;
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

  console.debug('dxf', dxf); // eslint-disable-line no-console
  console.debug('scene', canvasLayer.scene); // eslint-disable-line no-console

  canvasLayer.elements.forEach((element) => {
    canvasLayer.doAction(LayerActionID.Delete, element);
  });

  dxf.entities.forEach((entity: IEntity) => {
    addEntity(entity, getEntityLayer(entity, dxf.tables.layer), canvasLayer);
  });

  updateScene(canvasLayer.scene, dxf.tables.viewPort.viewPorts[0], canvasLayer);
}

function getEntityLayer(entity: IEntity, cadLayers: ILayersTable): ILayer {
  return cadLayers.layers[entity.layer];
}

function updateScene(scene: Scene, viewport: IViewPort, canvasLayer: FrameState) {
  const options = canvasLayer.options;
  options.background = {
    color: {
      fixed: hexFromColorRepr(viewport.ambientColor),
    },
  };

  canvasLayer.onChange(options);
  canvasLayer.updateData(scene.context);
}

function addEntity(entity: IEntity, entityLayer: ILayer, canvasLayer: FrameState) {
  try {
    if (isTextEntity(entity)) {
      addTextElement(entity, entityLayer, canvasLayer);
    } else if (isLineEntity(entity)) {
      addLineElement(entity, entityLayer, canvasLayer);
    } else if (isILwpolylineEntity(entity)) {
      addLwPolylineElement(entity, entityLayer, canvasLayer);
    } else if (isCircleEntity(entity)) {
      addCircleElement(entity, entityLayer, canvasLayer);
    } else if (isEllipseEntity(entity)) {
      addEllipseElement(entity, entityLayer, canvasLayer);
    } else if (isPointEntity(entity)) {
      addPointElement(entity, entityLayer, canvasLayer);
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

function isCircleEntity(entity: IEntity): entity is ICircleEntity {
  return entity.type === 'CIRCLE';
}

function isEllipseEntity(entity: IEntity): entity is IEllipseEntity {
  return entity.type === 'ELLIPSE';
}

function isPointEntity(entity: IEntity): entity is IPointEntity {
  return entity.type === 'POINT';
}

function addTextElement(entity: ITextEntity, entityLayer: ILayer, canvasLayer: FrameState) {
  const newTextItem: CanvasElementItem<TextConfig, TextData> = canvasElementRegistry.get('text');

  let newElementOptions: CanvasElementOptions = {
    ...newTextItem.getNewOptions(),
    type: newTextItem.id,
    name: '',
    constraint: BOTTOM_LEFT_CONSTRAINT,
    placement: {
      bottom: entity.startPoint.y * TEMP_MULTIPLIER,
      left: entity.startPoint.x * TEMP_MULTIPLIER,
      rotation: -entity.rotation,
      height: entity.textHeight * TEMP_MULTIPLIER,
      width: entity.textHeight * entity.text.length * TEMP_MULTIPLIER,
    },
    config: {
      text: { fixed: entity.text },
      size: entity.textHeight * TEMP_MULTIPLIER,
      color: {
        fixed: hexFromColorRepr(entity.color, entityLayer),
      },
      align: Align.Left,
      valign: VAlign.Bottom,
    },
  };

  canvasLayer.addElement(new ElementState(newTextItem, newElementOptions, canvasLayer));
}

function lineFromVertices(vertices: Array<{ x: number; y: number }>): Line {
  if (vertices.length !== 2) {
    throw new Error(`unexpected number of vertices: expected 2, got ${vertices.length}`);
  }

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

function addLineElement(entity: ILineEntity, entityLayer: ILayer, canvasLayer: FrameState) {
  canvasLayer.addElement(
    newLineElementState(
      lineFromVertices(entity.vertices),
      entity.lineweight,
      { fixed: hexFromColorRepr(entity.color, entityLayer) },
      canvasLayer
    )
  );
}

function addLwPolylineElement(entity: ILwpolylineEntity, entityLayer: ILayer, canvasLayer: FrameState) {
  for (let i = 0; i < entity.vertices.length - 1; i++) {
    canvasLayer.addElement(
      newLineElementState(
        lineFromVertices(entity.vertices.slice(i, i + 2)),
        entity.lineweight,
        { fixed: hexFromColorRepr(entity.color, entityLayer) },
        canvasLayer
      )
    );
  }
}

function newLineElementState(
  line: Line,
  lineWeight: number | undefined,
  color: ColorDimensionConfig,
  canvasLayer: FrameState
): ElementState {
  let weight = pixelsFromLineWeight(lineWeight);

  const newLineItem: CanvasElementItem<LineConfig, LineData> = canvasElementRegistry.get('line');
  let newElementOptions: CanvasElementOptions = {
    ...newLineItem.getNewOptions(),
    type: newLineItem.id,
    name: '',
    constraint: BOTTOM_LEFT_CONSTRAINT,
    placement: {
      bottom: (line.midPoint.y - weight / 2) * TEMP_MULTIPLIER,
      left: (line.midPoint.x - line.length / 2) * TEMP_MULTIPLIER,
      height: weight,
      width: line.length * TEMP_MULTIPLIER,
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
    midPoint: entity.center,
  };
}

function ellipseFromCadPoint(entity: IPointEntity): Ellipse {
  return {
    width: 1,
    height: 1,
    midPoint: entity.position,
  };
}

function addEllipseElement(entity: IEllipseEntity, entityLayer: ILayer, canvasLayer: FrameState) {
  canvasLayer.addElement(
    newEllipseElement(
      ellipseFromCadEllipse(entity),
      { fixed: hexFromColorRepr(entity.color, entityLayer) },
      entity.lineweight,
      canvasLayer
    )
  );
}

function addCircleElement(entity: ICircleEntity, entityLayer: ILayer, canvasLayer: FrameState) {
  canvasLayer.addElement(
    newEllipseElement(
      ellipseFromCadCircle(entity),
      { fixed: hexFromColorRepr(entity.color, entityLayer) },
      entity.lineweight,
      canvasLayer
    )
  );
}

function addPointElement(entity: IPointEntity, entityLayer: ILayer, canvasLayer: FrameState) {
  canvasLayer.addElement(
    newEllipseElement(
      ellipseFromCadPoint(entity),
      { fixed: hexFromColorRepr(entity.color, entityLayer) },
      entity.lineweight,
      canvasLayer,
      true
    )
  );
}

function newEllipseElement(
  ellipse: Ellipse,
  color: ColorDimensionConfig,
  lineWeight: number | undefined,
  canvasLayer: FrameState,
  isPoint?: boolean
) {
  let height = ellipse.height;
  let width = ellipse.width;
  if (!isPoint) {
    height = height * TEMP_MULTIPLIER;
    width = width * TEMP_MULTIPLIER;
  }

  const newEllipseItem: CanvasElementItem<EllipseConfig, EllipseData> = canvasElementRegistry.get('ellipse');
  let newElementOptions: CanvasElementOptions = {
    ...newEllipseItem.getNewOptions(),
    type: newEllipseItem.id,
    name: '',
    constraint: BOTTOM_LEFT_CONSTRAINT,
    placement: {
      bottom: (ellipse.midPoint.y - ellipse.height / 2) * TEMP_MULTIPLIER,
      left: (ellipse.midPoint.x - ellipse.width / 2) * TEMP_MULTIPLIER,
      height,
      width,
      rotation: ellipse.rotation ? -ellipse.rotation : 0,
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

function hexFromColorRepr(color: number | undefined, cadLayer?: ILayer): string {
  let hexColor: string;

  if (color) {
    hexColor = color.toString(16);
  } else if (cadLayer?.color) {
    hexColor = cadLayer.color.toString(16);
  } else {
    hexColor = 'ffffff';
  }

  return '#' + hexColor.padStart(6, '0');
}

function pixelsFromLineWeight(lineWeight: number | undefined): number {
  let weight = DEFAULT_LWEIGHT;
  if (lineWeight !== undefined && lineWeight !== 0) {
    weight = lineWeight;
  }
  return weight / 100 / 5; // weights are in 100ths of a mm
}
