import { AppEvents, Field, LinkModel, PluginState, SelectableValue } from '@grafana/data';
import { hasAlphaPanels } from 'app/core/config';

import appEvents from '../../../core/app_events';
import {
  advancedElementItems,
  CanvasElementItem,
  CanvasElementOptions,
  canvasElementRegistry,
  defaultElementItems,
  TextConfig,
} from '../../../features/canvas';
import { notFoundItem } from '../../../features/canvas/elements/notFound';
import { ElementState } from '../../../features/canvas/runtime/element';
import { FrameState } from '../../../features/canvas/runtime/frame';
import { Scene, SelectionParams } from '../../../features/canvas/runtime/scene';
import { DimensionContext } from '../../../features/dimensions';

import { AnchorPoint, ConnectionInfo } from './types';

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
  const newElementOptions = newItem.getNewOptions() as CanvasElementOptions;
  newElementOptions.type = newItem.id;

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

export function getDataLinks(ctx: DimensionContext, cfg: TextConfig, textData: string | undefined): LinkModel[] {
  const panelData = ctx.getPanelData();
  const frames = panelData?.series;

  const links: Array<LinkModel<Field>> = [];
  const linkLookup = new Set<string>();

  frames?.forEach((frame) => {
    const visibleFields = frame.fields.filter((field) => !Boolean(field.config.custom?.hideFrom?.tooltip));

    if (cfg.text?.field && visibleFields.some((f) => f.name === cfg.text?.field)) {
      const field = visibleFields.filter((field) => field.name === cfg.text?.field)[0];
      if (field?.getLinks) {
        const disp = field.display ? field.display(textData) : { text: `${textData}`, numeric: +textData! };
        field.getLinks({ calculatedValue: disp }).forEach((link) => {
          const key = `${link.title}/${link.href}`;
          if (!linkLookup.has(key)) {
            links.push(link);
            linkLookup.add(key);
          }
        });
      }
    }
  });

  return links;
}

export function isConnectionSource(element: ElementState) {
  return element.options.connections && element.options.connections.length > 0;
}
export function isConnectionTarget(element: ElementState, sceneByName: Map<string, ElementState>) {
  const connections = getConnections(sceneByName);
  return connections.some((connection) => connection.target === element);
}

export function getConnections(sceneByName: Map<string, ElementState>) {
  const connections: ConnectionInfo[] = [];
  for (let v of sceneByName.values()) {
    if (v.options.connections) {
      for (let c of v.options.connections) {
        const target = c.targetName ? sceneByName.get(c.targetName) : v.parent;
        if (target) {
          connections.push({
            source: v,
            target,
            info: c,
          });
        }
      }
    }
  }

  return connections;
}

export function getConnectionsByTarget(element: ElementState, scene: Scene) {
  return getConnections(scene.byName).filter((connection) => connection.target === element);
}

export function updateConnectionsForSource(element: ElementState, scene: Scene) {
  const targetConnections = getConnectionsByTarget(element, scene);
  targetConnections.forEach((connection) => {
    const sourceConnections = connection.source.options.connections?.splice(0) ?? [];
    const connections = sourceConnections.filter((con) => con.targetName !== element.getName());
    connection.source.onChange({ ...connection.source.options, connections });
  });
}
