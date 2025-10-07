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
// Remove import DxfParser from 'dxf-parser';

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

// In onImportFile, simplify to only handle draw.io
export async function onImportFile(target: EventTarget & HTMLInputElement, rootLayer?: FrameState) {
  if (target.files && target.files[0]) {
    const file = target.files[0];
    if (file.name.endsWith('.svg')) {
      handleSVGFile(file, rootLayer);
    }
  }
}

interface SVGElementInfo {
  markup: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Convert foreignObject to SVG text element
function convertForeignObjectToText(element: SVGForeignObjectElement, width: number, height: number): string {
  // Extract text content from nested divs
  const textContent = element.textContent?.trim() || '';

  if (!textContent) {
    return '';
  }

  // Try to extract styling from nested divs
  let fontSize = '12px';
  let fontFamily = 'Helvetica, Arial, sans-serif';
  let fill = '#000000';
  let textAnchor = 'middle';
  let alignmentBaseline = 'middle';
  let fontWeight = 'normal';
  let fontStyle = 'normal';

  // Look for style information in the foreignObject's children
  const divs = element.querySelectorAll('div');
  for (const div of Array.from(divs)) {
    const style = window.getComputedStyle(div);

    if (style.fontSize && style.fontSize !== '0px') {
      fontSize = style.fontSize;
    }
    if (style.fontFamily && style.fontFamily !== 'none') {
      fontFamily = style.fontFamily.replace(/['"]/g, '');
    }
    if (style.color && style.color !== 'rgba(0, 0, 0, 0)') {
      fill = style.color;
    }
    if (style.fontWeight && parseInt(style.fontWeight, 10) >= 600) {
      fontWeight = 'bold';
    }
    if (style.fontStyle === 'italic') {
      fontStyle = 'italic';
    }

    // Check text-align for text-anchor
    const textAlign = style.textAlign;
    if (textAlign === 'left' || textAlign === 'start') {
      textAnchor = 'start';
    } else if (textAlign === 'right' || textAlign === 'end') {
      textAnchor = 'end';
    } else if (textAlign === 'center') {
      textAnchor = 'middle';
    }

    // Check align-items for vertical alignment
    const alignItems = style.alignItems;
    if (alignItems === 'flex-start' || alignItems === 'start') {
      alignmentBaseline = 'hanging';
    } else if (alignItems === 'flex-end' || alignItems === 'end') {
      alignmentBaseline = 'baseline';
    } else if (alignItems === 'center') {
      alignmentBaseline = 'middle';
    }
  }

  // Calculate text position within the element's local coordinate system
  // The text should be positioned relative to (0, 0) since we're creating a new SVG with its own viewBox
  let textX = 0;
  let textY = 0;

  // Adjust horizontal position based on text anchor and width
  if (textAnchor === 'start') {
    textX = 0;
  } else if (textAnchor === 'middle') {
    textX = width / 2;
  } else if (textAnchor === 'end') {
    textX = width;
  }

  // Adjust vertical position based on alignment and height
  // For better visual centering, we need to account for font metrics
  const fontSizeNum = parseFloat(fontSize);
  if (alignmentBaseline === 'hanging') {
    textY = 0;
  } else if (alignmentBaseline === 'middle') {
    // Use a slight offset to better center the text visually
    // SVG's dominant-baseline="middle" aligns to the mathematical middle,
    // but visually we want it slightly lower to account for descenders
    textY = height / 2 + fontSizeNum * 0.1;
  } else if (alignmentBaseline === 'baseline') {
    textY = height;
  }

  // Create SVG text element with position and styling info
  return `<text x="${textX}" y="${textY}" font-family="${fontFamily}" font-size="${fontSize}" fill="${fill}" text-anchor="${textAnchor}" dominant-baseline="${alignmentBaseline}" font-weight="${fontWeight}" font-style="${fontStyle}">${textContent}</text>`;
}

async function parseSVGToElements(svgText: string): Promise<SVGElementInfo[]> {
  const elements: SVGElementInfo[] = [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement;

  // Check for parsing errors
  const parserError = svg.querySelector('parsererror');
  if (parserError) {
    throw new Error('Failed to parse SVG: ' + parserError.textContent);
  }

  // Create temporary SVG for measurements
  const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  tempSvg.setAttribute('width', svg.getAttribute('width') || '1000');
  tempSvg.setAttribute('height', svg.getAttribute('height') || '1000');
  tempSvg.setAttribute('viewBox', svg.getAttribute('viewBox') || '0 0 1000 1000');
  tempSvg.style.position = 'absolute';
  tempSvg.style.left = '-9999px';
  tempSvg.style.top = '-9999px';
  document.body.appendChild(tempSvg);

  // Clone the entire SVG content into temp SVG for accurate measurements
  const clonedContent = svg.cloneNode(true);
  if (clonedContent instanceof SVGSVGElement) {
    // Copy all children from cloned SVG to temp SVG
    while (clonedContent.firstChild) {
      tempSvg.appendChild(clonedContent.firstChild);
    }
  }

  // Recursively process all elements
  function processElement(element: Element, depth = 0): void {
    // Skip non-SVG elements
    if (!(element instanceof SVGElement)) {
      return;
    }

    // Skip defs, metadata, and other non-visual elements
    const skipTags = ['defs', 'metadata', 'style', 'script', 'title', 'desc'];
    if (skipTags.includes(element.tagName.toLowerCase())) {
      return;
    }

    const tagName = element.tagName.toLowerCase();

    // Special handling for foreignObject - treat it as a leaf element even if it has children
    // because its children are HTML/text content, not SVG elements to be separated
    const isForeignObject = tagName === 'foreignobject';

    // Check if this element has any visual SVG children (not applicable for foreignObject)
    const visualChildren = isForeignObject
      ? []
      : Array.from(element.children).filter((child) => {
          if (!(child instanceof SVGElement)) {
            return false;
          }
          const childTag = child.tagName.toLowerCase();
          return !skipTags.includes(childTag);
        });

    // If element has visual children, recurse into them instead of adding this element
    if (visualChildren.length > 0) {
      for (const child of visualChildren) {
        processElement(child, depth + 1);
      }
      return;
    }

    // Special handling for foreignObject - convert to text
    if (isForeignObject && element instanceof SVGForeignObjectElement) {
      let x = parseFloat(element.getAttribute('x') || '0');
      let y = parseFloat(element.getAttribute('y') || '0');

      // Don't parse percentage values as numbers - they'll be extracted from nested divs
      const widthAttrRaw = element.getAttribute('width') || '0';
      const heightAttrRaw = element.getAttribute('height') || '0';
      let width = widthAttrRaw.includes('%') ? 0 : parseFloat(widthAttrRaw);
      let height = heightAttrRaw.includes('%') ? 0 : parseFloat(heightAttrRaw);

      // Handle percentage-based dimensions by extracting from nested div styles
      const widthAttr = element.getAttribute('width');
      const heightAttr = element.getAttribute('height');
      if (widthAttr?.includes('%') || heightAttr?.includes('%') || width === 0 || height === 0) {
        // Extract position and dimensions from nested div styles (draw.io uses margin-left, padding-top, width)
        const divs = element.querySelectorAll('div');
        for (const div of Array.from(divs)) {
          const style = window.getComputedStyle(div);

          // Check for inline styles first (more accurate for draw.io)
          const inlineStyle = div.getAttribute('style') || '';

          // Extract margin-left
          const marginLeftMatch = inlineStyle.match(/margin-left:\s*(\d+)px/);
          if (marginLeftMatch) {
            x = parseFloat(marginLeftMatch[1]);
          } else if (style.marginLeft && style.marginLeft !== '0px') {
            x = parseFloat(style.marginLeft);
          }

          // Extract padding-top (used for vertical positioning in draw.io)
          const paddingTopMatch = inlineStyle.match(/padding-top:\s*(\d+)px/);
          if (paddingTopMatch) {
            y = parseFloat(paddingTopMatch[1]);
          } else if (style.paddingTop && style.paddingTop !== '0px') {
            y = parseFloat(style.paddingTop);
          }

          // Extract width
          const widthMatch = inlineStyle.match(/width:\s*(\d+)px/);
          if (widthMatch) {
            width = parseFloat(widthMatch[1]);
          } else if (style.width && style.width !== 'auto' && !style.width.includes('%')) {
            width = parseFloat(style.width);
          }

          // Extract height (often 1px in draw.io, we'll use font size as fallback)
          const heightMatch = inlineStyle.match(/height:\s*(\d+)px/);
          if (heightMatch) {
            const h = parseFloat(heightMatch[1]);
            if (h > 1) {
              height = h;
            }
          } else if (style.height && style.height !== 'auto' && !style.height.includes('%')) {
            const h = parseFloat(style.height);
            if (h > 1) {
              height = h;
            }
          }

          // If we found position/size info, break
          if (x > 0 || y > 0 || width > 0) {
            // Use a reasonable default height if not specified or too small
            if (height <= 1) {
              const fontSize = parseFloat(style.fontSize || '12');
              height = fontSize * 1.5; // Line height approximation
            }

            // Adjust y position - padding-top positions the container, but we need to account for
            // the text being vertically centered within that container
            // Subtract half the height to position the element so its center is at the padding-top position
            if (y > 0) {
              y = y - height / 2;
            }
            break;
          }
        }
      }

      if (width > 0 && height > 0) {
        const textElement = convertForeignObjectToText(element, width, height);
        if (textElement) {
          // Create SVG with converted text element - no transform needed since text is already in relative coords
          const shiftedMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${textElement}</svg>`;

          elements.push({
            markup: shiftedMarkup,
            x,
            y,
            width,
            height,
          });
        }
      }
      return;
    }

    // This is a leaf element - try to get bounding box
    let bbox: DOMRect | null = null;
    try {
      // Check if element is an SVGGraphicsElement which has getBBox
      if ('getBBox' in element && typeof element.getBBox === 'function') {
        bbox = element.getBBox();
      }
    } catch (e) {
      // Some elements don't support getBBox
    }

    // If element has valid dimensions, add it
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      // Create shifted markup with proper viewBox
      const shiftedMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bbox.width} ${bbox.height}"><g transform="translate(${-bbox.x} ${-bbox.y})">${element.outerHTML}</g></svg>`;

      elements.push({
        markup: shiftedMarkup,
        x: bbox.x,
        y: bbox.y,
        width: bbox.width,
        height: bbox.height,
      });
    }
  }

  // Start processing from the root
  for (const child of Array.from(tempSvg.children)) {
    processElement(child);
  }

  // Cleanup
  document.body.removeChild(tempSvg);

  console.log('Parsed SVG elements:', elements);
  return elements;
}

export async function handleSVGFile(file: File, rootLayer?: FrameState) {
  const fileText = await file.text();
  try {
    const elements = await parseSVGToElements(fileText);

    if (rootLayer && elements.length > 0) {
      // Get the SVG element item from registry
      const svgItem = canvasElementRegistry.getIfExists('svg');
      if (!svgItem) {
        console.error('SVG element type not found in registry');
        return;
      }

      // Add each parsed element to the canvas
      for (const element of elements) {
        const newElementOptions: CanvasElementOptions = {
          ...svgItem.getNewOptions(),
          type: 'svg',
          name: rootLayer.scene.getNextElementName(),
          placement: {
            top: element.y,
            left: element.x,
            width: element.width,
            height: element.height,
            rotation: 0,
          },
          config: {
            content: {
              mode: 'fixed' as const,
              fixed: element.markup,
            },
          },
        };

        const newElement = new ElementState(svgItem, newElementOptions, rootLayer);
        newElement.updateData(rootLayer.scene.context);
        rootLayer.elements.push(newElement);
      }

      // Save and update the scene
      rootLayer.scene.save();
      rootLayer.reinitializeMoveable();

      console.log(`Added ${elements.length} SVG elements to canvas`);
    }
  } catch (error) {
    console.error('Error parsing SVG file:', error);
  }
}
