import { DxfParser, IEntity, ILayer, ILayersTable, ITextEntity, IViewPort } from 'dxf-parser';

import {
  CanvasElementItem,
  CanvasElementOptions,
  canvasElementRegistry,
  HorizontalConstraint,
  TextConfig,
  TextData,
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

export async function handleDxfFile(file: File, layer: FrameState) {
  let fileText = await file.text();

  const parser = new DxfParser();
  const dxf = parser.parseSync(fileText);
  if (!dxf) {
    throw new Error('Failed to parse DXF file');
  }

  console.debug('dxf', dxf); // eslint-disable-line no-console
  console.debug('scene', layer.scene); // eslint-disable-line no-console

  dxf.entities.forEach((entity: IEntity) => {
    addEntity(entity, dxf.tables.layer, layer);
  });

  updateScene(layer.scene, dxf.tables.viewPort.viewPorts[0], layer);
}

function updateScene(scene: Scene, viewport: IViewPort, layer: FrameState) {
  // set scene background color to first viewport background color
  scene.updateColor({
    fixed: fromColorRepr(viewport.ambientColor),
  });

  layer.scene.save();
  layer.reinitializeMoveable();
}

function addEntity(entity: IEntity, cadLayers: ILayersTable, layer: FrameState) {
  if (isTextEntity(entity)) {
    let text = entity;
    addTextElement(text, cadLayers, layer);
  } else {
    console.warn('unhandled entity type', entity.type);
  }
}

function isTextEntity(entity: IEntity): entity is ITextEntity {
  return entity.type === 'TEXT';
}

function addTextElement(text: ITextEntity, cadLayers: ILayersTable, layer: FrameState) {
  const newTextItem: CanvasElementItem<TextConfig, TextData> = canvasElementRegistry.get('text');

  let newElementOptions: CanvasElementOptions = {
    ...newTextItem.getNewOptions(),
    type: newTextItem.id,
    name: '',
    constraint: BOTTOM_LEFT_CONSTRAINT,
    placement: {
      bottom: text.startPoint.y * TEMP_MULTIPLIER,
      left: text.startPoint.x * TEMP_MULTIPLIER,
      rotation: -text.rotation,
      height: text.textHeight * TEMP_MULTIPLIER * 2.5,
      width: text.textHeight * text.text.length * TEMP_MULTIPLIER,
    },
    config: {
      text: { fixed: text.text },
      size: text.textHeight * TEMP_MULTIPLIER,
      color: {
        fixed: fromColorRepr(text.color, cadLayers.layers[text.layer]),
      },
    },
  };

  addElement(newTextItem, newElementOptions, layer);
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

  return '#' + hexColor.padStart(6 - hexColor.length, '0');
}

function addElement(item: CanvasElementItem, options: CanvasElementOptions, layer: FrameState) {
  const newElement = new ElementState(item, options, layer);
  newElement.updateData(layer.scene.context);
  layer.elements.push(newElement);
}
