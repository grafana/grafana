import { DxfParser, IEntity, ILayer, ILayersTable, ITextEntity, IViewPort } from 'dxf-parser';

import {
  Align,
  CanvasElementItem,
  CanvasElementOptions,
  canvasElementRegistry,
  HorizontalConstraint,
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

const TEMP_MULTIPLIER = 20;

export async function handleDxfFile(file: File, canvasLayer: FrameState) {
  let fileText = await file.text();

  const parser = new DxfParser();
  const dxf = parser.parseSync(fileText);
  if (!dxf) {
    throw new Error('Failed to parse DXF file');
  }

  console.debug('dxf', dxf); // eslint-disable-line no-console
  console.debug('scene', canvasLayer.scene); // eslint-disable-line no-console

  canvasLayer.elements = [];

  dxf.entities.forEach((entity: IEntity) => {
    addEntity(entity, getEntityLayer(entity, dxf.tables.layer), canvasLayer);
  });

  updateScene(canvasLayer.scene, dxf.tables.viewPort.viewPorts[0], canvasLayer);
}

function getEntityLayer(entity: IEntity, cadLayers: ILayersTable): ILayer {
  return cadLayers.layers[entity.layer];
}

function updateScene(scene: Scene, viewport: IViewPort, layer: FrameState) {
  // set scene background color to first viewport background color
  scene.updateColor({
    fixed: fromColorRepr(viewport.ambientColor),
  });

  scene.updateCurrentLayer(layer);
}

function addEntity(entity: IEntity, entityLayer: ILayer, canvasLayer: FrameState) {
  if (isTextEntity(entity)) {
    addTextElement(entity, entityLayer, canvasLayer);
  } else {
    console.warn('unhandled entity type', entity.type);
  }
}

function isTextEntity(entity: IEntity): entity is ITextEntity {
  return entity.type === 'TEXT';
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
      height: entity.textHeight * TEMP_MULTIPLIER * 2.5,
      width: entity.textHeight * entity.text.length * TEMP_MULTIPLIER,
    },
    config: {
      text: { fixed: entity.text },
      size: entity.textHeight * TEMP_MULTIPLIER,
      color: {
        fixed: fromColorRepr(entity.color, entityLayer),
      },
      align: Align.Left,
      valign: VAlign.Bottom,
    },
  };

  addElement(newTextItem, newElementOptions, canvasLayer);
}

function fromColorRepr(color: number | undefined, cadLayer?: ILayer): string {
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

function addElement(item: CanvasElementItem, options: CanvasElementOptions, layer: FrameState) {
  const newElement = new ElementState(item, options, layer);
  newElement.updateData(layer.scene.context);
  layer.elements.push(newElement);
}
