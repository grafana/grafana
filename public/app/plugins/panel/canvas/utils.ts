import { isNumber, isString } from 'lodash';

import { DataFrame, Field, AppEvents, getFieldDisplayName, PluginState, SelectableValue } from '@grafana/data';
import { ConnectionDirection } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { hasAlphaPanels, config } from 'app/core/config';
import { CanvasConnection, CanvasElementItem, CanvasElementOptions } from 'app/features/canvas/element';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { advancedElementItems, canvasElementRegistry, defaultElementItems } from 'app/features/canvas/registry';
import { ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { Scene, SelectionParams } from 'app/features/canvas/runtime/scene';

import { AnchorPoint, ConnectionState, LineStyle, StrokeDasharray } from './types';

export function doSelect(scene: Scene, element: ElementState | FrameState) {
  try {
    let selection: SelectionParams = { targets: [] };
    if (element instanceof FrameState) {
      const targetElements: HTMLDivElement[] = [];
      targetElements.push(element?.div!);
      selection.targets = targetElements;
      selection.frame = element;
      scene.select(selection);
    } else {
      scene.currentLayer = element.parent;
      selection.targets = [element?.div!];
      scene.select(selection);
    }
  } catch (error) {
    appEvents.emit(AppEvents.alertError, ['Unable to select element, try selecting element in panel instead']);
  }
}

export function getElementTypes(shouldShowAdvancedTypes: boolean | undefined, current?: string): RegistrySelectInfo {
  if (shouldShowAdvancedTypes) {
    return getElementTypesOptions([...defaultElementItems, ...advancedElementItems], current);
  }

  return getElementTypesOptions([...defaultElementItems], current);
}

interface RegistrySelectInfo {
  options: Array<SelectableValue<string>>;
  current: Array<SelectableValue<string>>;
}

export function getElementTypesOptions(items: CanvasElementItem[], current: string | undefined): RegistrySelectInfo {
  const selectables: RegistrySelectInfo = { options: [], current: [] };
  const alpha: Array<SelectableValue<string>> = [];

  for (const item of items) {
    const option: SelectableValue<string> = { label: item.name, value: item.id, description: item.description };
    if (item.state === PluginState.alpha) {
      if (!hasAlphaPanels) {
        continue;
      }
      option.label = `${item.name} (Alpha)`;
      alpha.push(option);
    } else {
      selectables.options.push(option);
    }

    if (item.id === current) {
      selectables.current.push(option);
    }
  }

  for (const a of alpha) {
    selectables.options.push(a);
  }

  return selectables;
}

export function onAddItem(sel: SelectableValue<string>, rootLayer: FrameState | undefined, anchorPoint?: AnchorPoint) {
  const newItem = canvasElementRegistry.getIfExists(sel.value) ?? notFoundItem;
  const newElementOptions: CanvasElementOptions = {
    ...newItem.getNewOptions(),
    type: newItem.id,
    name: '',
  };

  if (anchorPoint) {
    newElementOptions.placement = { ...newElementOptions.placement, top: anchorPoint.y, left: anchorPoint.x };
  }

  if (newItem.defaultSize) {
    newElementOptions.placement = { ...newElementOptions.placement, ...newItem.defaultSize };
  }

  if (rootLayer) {
    const newElement = new ElementState(newItem, newElementOptions, rootLayer);
    newElement.updateData(rootLayer.scene.context);
    rootLayer.elements.push(newElement);
    rootLayer.scene.save();
    rootLayer.reinitializeMoveable();

    setTimeout(() => doSelect(rootLayer.scene, newElement));
  }
}

export function isConnectionSource(element: ElementState) {
  return element.options.connections && element.options.connections.length > 0;
}

export function isConnectionTarget(element: ElementState, sceneByName: Map<string, ElementState>) {
  const connections = getConnections(sceneByName);
  return connections.some((connection) => connection.target === element);
}

export function getConnections(sceneByName: Map<string, ElementState>) {
  const connections: ConnectionState[] = [];
  for (let v of sceneByName.values()) {
    if (v.options.connections) {
      v.options.connections.forEach((c, index) => {
        // @TODO Remove after v10.x
        if (isString(c.color)) {
          c.color = { fixed: c.color };
        }

        if (isNumber(c.size)) {
          c.size = { fixed: 2, min: 1, max: 10 };
        }

        const target = c.targetName ? sceneByName.get(c.targetName) : v.parent;
        if (target) {
          connections.push({
            index,
            source: v,
            target,
            info: c,
            vertices: c.vertices ?? undefined,
            sourceOriginal: c.sourceOriginal ?? undefined,
            targetOriginal: c.targetOriginal ?? undefined,
          });
        }
      });
    }
  }

  return connections;
}

export function getConnectionsByTarget(element: ElementState, scene: Scene) {
  return scene.connections.state.filter((connection) => connection.target === element);
}

export function updateConnectionsForSource(element: ElementState, scene: Scene) {
  const targetConnections = getConnectionsByTarget(element, scene);
  targetConnections.forEach((connection) => {
    const sourceConnections = connection.source.options.connections?.splice(0) ?? [];
    const connections = sourceConnections.filter((con) => con.targetName !== element.getName());
    connection.source.onChange({ ...connection.source.options, connections });
  });

  // Update scene connection state to clear out old connections
  scene.connections.updateState();
}

export const calculateCoordinates = (
  sourceRect: DOMRect,
  parentRect: DOMRect,
  info: CanvasConnection,
  target: ElementState,
  transformScale: number
) => {
  const sourceHorizontalCenter = sourceRect.left - parentRect.left + sourceRect.width / 2;
  const sourceVerticalCenter = sourceRect.top - parentRect.top + sourceRect.height / 2;

  // Convert from connection coords to DOM coords
  const x1 = (sourceHorizontalCenter + (info.source.x * sourceRect.width) / 2) / transformScale;
  const y1 = (sourceVerticalCenter - (info.source.y * sourceRect.height) / 2) / transformScale;

  let x2: number;
  let y2: number;
  const targetRect = target.div?.getBoundingClientRect();
  if (info.targetName && targetRect) {
    const targetHorizontalCenter = targetRect.left - parentRect.left + targetRect.width / 2;
    const targetVerticalCenter = targetRect.top - parentRect.top + targetRect.height / 2;

    x2 = targetHorizontalCenter + (info.target.x * targetRect.width) / 2;
    y2 = targetVerticalCenter - (info.target.y * targetRect.height) / 2;
  } else {
    const parentHorizontalCenter = parentRect.width / 2;
    const parentVerticalCenter = parentRect.height / 2;

    x2 = parentHorizontalCenter + (info.target.x * parentRect.width) / 2;
    y2 = parentVerticalCenter - (info.target.y * parentRect.height) / 2;
  }
  x2 /= transformScale;
  y2 /= transformScale;

  // TODO look into a better way to avoid division by zero
  if (x2 - x1 === 0) {
    x2 += 1;
  }
  if (y2 - y1 === 0) {
    y2 += 1;
  }
  return { x1, y1, x2, y2 };
};

export const calculateCoordinates2 = (source: ElementState, target: ElementState, info: CanvasConnection) => {
  const { x: x1, y: y1 } = getRotatedConnectionPoint(source.div!, info.source.x, info.source.y);

  let x2 = 0;
  let y2 = 0;
  const targetDiv = target.div;
  if (info.targetName && targetDiv) {
    ({ x: x2, y: y2 } = getRotatedConnectionPoint(targetDiv, info.target.x, info.target.y));
  } else {
    x2 = info.target.x;
    y2 = info.target.y;
  }

  return { x1, y1, x2, y2 };
};

export const getElementTransformAndDimensions = (element: Element) => {
  const style = window.getComputedStyle(element);

  const transform = style.transform;

  let x = 0;
  let y = 0;
  let rotation = 0;

  if (transform !== 'none') {
    // Use DOMMatrix to parse the transform string
    const matrix = new DOMMatrix(transform);

    // Extract x and y values
    x = matrix.m41;
    y = matrix.m42;

    // Extract rotation in radians and convert to degrees
    // For 2D transforms, rotation = atan2(m21, m11)
    rotation = -Math.atan2(matrix.m21, matrix.m11) * (180 / Math.PI);
  }

  // Get the width and height of the element
  // TODO: there sould be a better way than parseFloat
  const width = parseFloat(style.width);
  const height = parseFloat(style.height);

  return { left: x, top: y, width, height, x, y, rotation };
};

export const getNormalizedRotatedOffset = (div: HTMLDivElement, x: number, y: number) => {
  const { left, top, width, height, rotation } = getElementTransformAndDimensions(div);
  // Calculate center of source element
  const centerX = left + width / 2;
  const centerY = top + height / 2;

  // Calculate the offset from the center to the connection start point
  let dx = x - centerX;
  let dy = y - centerY;

  // Adjust for rotation
  const rad = rotation * (Math.PI / 180);
  const cos = Math.cos(-rad);
  const sin = Math.sin(-rad);
  // Rotate the delta by the negative of the element's rotation
  const rotatedDx = dx * cos - dy * sin;
  const rotatedDy = dx * sin + dy * cos;

  // Convert to normalized coordinates
  const normalizedX = rotatedDx / (width / 2);
  const normalizedY = -rotatedDy / (height / 2);

  return { x: normalizedX, y: normalizedY };
};

export const getRotatedConnectionPoint = (div: HTMLDivElement, normalizedX: number, normalizedY: number) => {
  const { left, top, width, height, rotation } = getElementTransformAndDimensions(div);
  const centerX = left + width / 2;
  const centerY = top + height / 2;

  // Calculate offset from center before rotation
  const offsetX = (normalizedX * width) / 2;
  const offsetY = -(normalizedY * height) / 2;

  // Convert rotation to radians
  const rad = rotation * (Math.PI / 180);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // Apply rotation to offset
  const rotatedOffsetX = offsetX * cos - offsetY * sin;
  const rotatedOffsetY = offsetX * sin + offsetY * cos;

  const x = centerX + rotatedOffsetX;
  const y = centerY + rotatedOffsetY;

  return { x, y };
};

export const calculateMidpoint = (x1: number, y1: number, x2: number, y2: number) => {
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
};

export const calculateAbsoluteCoords = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  valueX: number,
  valueY: number,
  deltaX: number,
  deltaY: number
) => {
  return { x: valueX * deltaX + x1, y: valueY * deltaY + y1 };
};

// Calculate angle between two points and return angle in radians
export const calculateAngle = (x1: number, y1: number, x2: number, y2: number) => {
  return Math.atan2(y2 - y1, x2 - x1);
};

export const calculateDistance = (x1: number, y1: number, x2: number, y2: number) => {
  //TODO add sqrt approx option
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
};

// @TODO revisit, currently returning last row index for field
export const getRowIndex = (fieldName: string | undefined, scene: Scene) => {
  if (fieldName) {
    const series = scene.data?.series[0];
    const field = series?.fields.find((field) => field.name === fieldName);
    const data = field?.values;
    return data ? data.length - 1 : 0;
  }
  return 0;
};

export const getConnectionStyles = (
  info: CanvasConnection,
  scene: Scene,
  defaultArrowSize: number,
  defaultArrowDirection: ConnectionDirection
) => {
  const defaultArrowColor = config.theme2.colors.text.primary;
  const lastRowIndex = getRowIndex(info.size?.field, scene);
  const strokeColor = info.color ? scene.context.getColor(info.color).value() : defaultArrowColor;
  const strokeWidth = info.size ? scene.context.getScale(info.size).get(lastRowIndex) : defaultArrowSize;
  const strokeRadius = info.radius ? scene.context.getScale(info.radius).get(lastRowIndex) : 0;
  const arrowDirection = info.direction
    ? scene.context.getDirection(info.direction).get(lastRowIndex)
    : defaultArrowDirection;
  const lineStyle = getLineStyle(info.lineStyle?.style);
  const shouldAnimate = info.lineStyle?.animate;

  return { strokeColor, strokeWidth, strokeRadius, arrowDirection, lineStyle, shouldAnimate };
};

const getLineStyle = (lineStyle?: LineStyle) => {
  switch (lineStyle) {
    case LineStyle.Dashed:
      return StrokeDasharray.Dashed;
    case LineStyle.Dotted:
      return StrokeDasharray.Dotted;
    default:
      return StrokeDasharray.Solid;
  }
};

export const getParentBoundingClientRect = (scene: Scene) => {
  if (config.featureToggles.canvasPanelPanZoom) {
    return scene.viewportDiv?.getBoundingClientRect();
  }

  return scene.div?.getBoundingClientRect();
};

export function getElementFields(frames: DataFrame[], opts: CanvasElementOptions) {
  const fields = new Set<Field>();
  const cfg = opts.config ?? {};

  frames.forEach((frame) => {
    frame.fields.forEach((field) => {
      const name = getFieldDisplayName(field, frame, frames);

      // (intentional fall-through)
      switch (name) {
        // General element config
        case opts.background?.color?.field:
        case opts.background?.image?.field:
        case opts.border?.color?.field:
        // Text config
        case cfg.text?.field:
        case cfg.color?.field:
        // Icon config
        case cfg.path?.field:
        case cfg.fill?.field:
        // Server config
        case cfg.blinkRate?.field:
        case cfg.statusColor?.field:
        case cfg.bulbColor?.field:
        // Wind turbine config (maybe remove / not support this?)
        case cfg.rpm?.field:
          fields.add(field);
      }
    });
  });

  return [...fields];
}

export function applyStyles(styles: React.CSSProperties, target: HTMLDivElement) {
  // INFO: CSSProperties can't be applied using setProperty, so we use Object.assign
  Object.assign(target.style, styles);
}

export function removeStyles(styles: React.CSSProperties, target: HTMLDivElement) {
  for (const key in styles) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
    target.style[key as any] = '';
  }
}
