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
  TextData,
} from '../../../features/canvas';
import { notFoundItem } from '../../../features/canvas/elements/notFound';
import { ElementState } from '../../../features/canvas/runtime/element';
import { FrameState } from '../../../features/canvas/runtime/frame';
import { Scene, SelectionParams } from '../../../features/canvas/runtime/scene';
import { DimensionContext } from '../../../features/dimensions';

import { AnchorPoint } from './types';

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

export function setDataLinks(ctx: DimensionContext, cfg: TextConfig, data: TextData) {
  const panelData = ctx.getPanelData();
  const frames = panelData?.series;

  frames?.forEach((frame) => {
    if (cfg.text?.field && frame.fields.some((f) => f.name === cfg.text?.field)) {
      const links: Array<LinkModel<Field>> = [];
      const linkLookup = new Set<string>();
      const field = frame.fields.filter((field) => field.name === cfg.text?.field)[0];
      if (field?.getLinks) {
        const disp = field.display ? field.display(data.text) : { text: `${data.text}`, numeric: +data.text! };
        field.getLinks({ calculatedValue: disp }).forEach((link) => {
          const key = `${link.title}/${link.href}`;
          if (!linkLookup.has(key)) {
            links.push(link);
            linkLookup.add(key);
          }
        });
      }

      data.links = links;
    }
  });
}
