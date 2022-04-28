import { css } from '@emotion/css';
import Moveable from 'moveable';
import React, { CSSProperties } from 'react';
import { ReplaySubject, Subject } from 'rxjs';
import { first } from 'rxjs/operators';
import Selecto from 'selecto';

import { GrafanaTheme2, PanelData } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { CanvasGroupOptions, DEFAULT_CANVAS_ELEMENT_CONFIG } from 'app/features/canvas';
import {
  ColorDimensionConfig,
  ResourceDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
  DimensionContext,
  ScalarDimensionConfig,
} from 'app/features/dimensions';
import {
  getColorDimensionFromData,
  getScaleDimensionFromData,
  getResourceDimensionFromData,
  getTextDimensionFromData,
  getScalarDimensionFromData,
} from 'app/features/dimensions/utils';
import { LayerActionID } from 'app/plugins/panel/canvas/types';

import { ElementState } from './element';
import { GroupState } from './group';
import { RootElement } from './root';

export interface SelectionParams {
  targets: Array<HTMLElement | SVGElement>;
  group?: GroupState;
}

export class Scene {
  styles = getStyles(config.theme2);
  readonly selection = new ReplaySubject<ElementState[]>(1);
  readonly moved = new Subject<number>(); // called after resize/drag for editor updates
  readonly byName = new Map<string, ElementState>();
  root: RootElement;

  revId = 0;

  width = 0;
  height = 0;
  style: CSSProperties = {};
  data?: PanelData;
  selecto?: Selecto;
  moveable?: Moveable;
  div?: HTMLDivElement;
  currentLayer?: GroupState;
  isEditingEnabled?: boolean;

  constructor(cfg: CanvasGroupOptions, enableEditing: boolean, public onSave: (cfg: CanvasGroupOptions) => void) {
    this.root = this.load(cfg, enableEditing);
  }

  getNextElementName = (isGroup = false) => {
    const label = isGroup ? 'Group' : 'Element';
    let idx = this.byName.size + 1;

    const max = idx + 100;
    while (true && idx < max) {
      const name = `${label} ${idx++}`;
      if (!this.byName.has(name)) {
        return name;
      }
    }

    return `${label} ${Date.now()}`;
  };

  canRename = (v: string) => {
    return !this.byName.has(v);
  };

  load(cfg: CanvasGroupOptions, enableEditing: boolean) {
    this.root = new RootElement(
      cfg ?? {
        type: 'group',
        elements: [DEFAULT_CANVAS_ELEMENT_CONFIG],
      },
      this,
      this.save // callback when changes are made
    );

    this.isEditingEnabled = enableEditing;

    setTimeout(() => {
      if (this.div) {
        // If editing is enabled, clear selecto instance
        const destroySelecto = enableEditing;
        this.initMoveable(destroySelecto, enableEditing);
        this.currentLayer = this.root;
        this.selection.next([]);
      }
    }, 100);
    return this.root;
  }

  context: DimensionContext = {
    getColor: (color: ColorDimensionConfig) => getColorDimensionFromData(this.data, color),
    getScale: (scale: ScaleDimensionConfig) => getScaleDimensionFromData(this.data, scale),
    getScalar: (scalar: ScalarDimensionConfig) => getScalarDimensionFromData(this.data, scalar),
    getText: (text: TextDimensionConfig) => getTextDimensionFromData(this.data, text),
    getResource: (res: ResourceDimensionConfig) => getResourceDimensionFromData(this.data, res),
  };

  updateData(data: PanelData) {
    this.data = data;
    this.root.updateData(this.context);
  }

  updateSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.style = { width, height };

    if (this.selecto?.getSelectedTargets().length) {
      this.clearCurrentSelection();
    }
  }

  groupSelection() {
    this.selection.pipe(first()).subscribe((currentSelectedElements) => {
      const currentLayer = currentSelectedElements[0].parent!;

      const newLayer = new GroupState(
        {
          type: 'group',
          name: this.getNextElementName(true),
          elements: [],
        },
        this,
        currentSelectedElements[0].parent
      );

      currentSelectedElements.forEach((element: ElementState) => {
        currentLayer.doAction(LayerActionID.Delete, element);
        newLayer.doAction(LayerActionID.Duplicate, element, false);
      });

      currentLayer.elements.push(newLayer);

      this.byName.set(newLayer.getName(), newLayer);

      this.save();
    });
  }

  clearCurrentSelection() {
    let event: MouseEvent = new MouseEvent('click');
    this.selecto?.clickTarget(event, this.div);
  }

  updateCurrentLayer(newLayer: GroupState) {
    this.currentLayer = newLayer;
    this.clearCurrentSelection();
    this.save();
  }

  save = (updateMoveable = false) => {
    this.onSave(this.root.getSaveModel());

    if (updateMoveable) {
      setTimeout(() => {
        if (this.div) {
          this.initMoveable(true, this.isEditingEnabled);
        }
      }, 100);
    }
  };

  private findElementByTarget = (target: HTMLElement | SVGElement): ElementState | undefined => {
    // We will probably want to add memoization to this as we are calling on drag / resize

    const stack = [...this.root.elements];
    while (stack.length > 0) {
      const currentElement = stack.shift();

      if (currentElement && currentElement.div && currentElement.div === target) {
        return currentElement;
      }

      const nestedElements = currentElement instanceof GroupState ? currentElement.elements : [];
      for (const nestedElement of nestedElements) {
        stack.unshift(nestedElement);
      }
    }

    return undefined;
  };

  setRef = (sceneContainer: HTMLDivElement) => {
    this.div = sceneContainer;
  };

  select = (selection: SelectionParams) => {
    if (this.selecto) {
      this.selecto.setSelectedTargets(selection.targets);
      this.updateSelection(selection);
    }
  };

  private updateSelection = (selection: SelectionParams) => {
    this.moveable!.target = selection.targets;

    if (selection.group) {
      this.selection.next([selection.group]);
    } else {
      const s = selection.targets.map((t) => this.findElementByTarget(t)!);
      this.selection.next(s);
    }
  };

  private generateTargetElements = (rootElements: ElementState[]): HTMLDivElement[] => {
    let targetElements: HTMLDivElement[] = [];

    const stack = [...rootElements];
    while (stack.length > 0) {
      const currentElement = stack.shift();

      if (currentElement && currentElement.div) {
        targetElements.push(currentElement.div);
      }

      const nestedElements = currentElement instanceof GroupState ? currentElement.elements : [];
      for (const nestedElement of nestedElements) {
        stack.unshift(nestedElement);
      }
    }

    return targetElements;
  };

  initMoveable = (destroySelecto = false, allowChanges = true) => {
    const targetElements = this.generateTargetElements(this.root.elements);

    if (destroySelecto && this.selecto) {
      this.selecto.destroy();
    }

    this.selecto = new Selecto({
      container: this.div,
      selectableTargets: targetElements,
      selectByClick: true,
    });

    this.moveable = new Moveable(this.div!, {
      draggable: allowChanges,
      resizable: allowChanges,
      origin: false,
    })
      .on('clickGroup', (event) => {
        this.selecto!.clickTarget(event.inputEvent, event.inputTarget);
      })
      .on('drag', (event) => {
        const targetedElement = this.findElementByTarget(event.target);
        targetedElement!.applyDrag(event);
      })
      .on('dragGroup', (e) => {
        e.events.forEach((event) => {
          const targetedElement = this.findElementByTarget(event.target);
          targetedElement!.applyDrag(event);
        });
      })
      .on('dragEnd', (event) => {
        const targetedElement = this.findElementByTarget(event.target);
        if (targetedElement) {
          targetedElement?.setPlacementFromConstraint();
        }

        this.moved.next(Date.now());
      })
      .on('resize', (event) => {
        const targetedElement = this.findElementByTarget(event.target);
        targetedElement!.applyResize(event);
        this.moved.next(Date.now()); // TODO only on end
      })
      .on('resizeGroup', (e) => {
        e.events.forEach((event) => {
          const targetedElement = this.findElementByTarget(event.target);
          targetedElement!.applyResize(event);
        });
        this.moved.next(Date.now()); // TODO only on end
      })
      .on('resizeEnd', (event) => {
        const targetedElement = this.findElementByTarget(event.target);

        if (targetedElement) {
          targetedElement?.setPlacementFromConstraint();
        }
      });

    let targets: Array<HTMLElement | SVGElement> = [];
    this.selecto!.on('dragStart', (event) => {
      const selectedTarget = event.inputEvent.target;

      const isTargetMoveableElement =
        this.moveable!.isMoveableElement(selectedTarget) ||
        targets.some((target) => target === selectedTarget || target.contains(selectedTarget));

      if (isTargetMoveableElement) {
        // Prevent drawing selection box when selected target is a moveable element
        event.stop();
      }
    }).on('selectEnd', (event) => {
      targets = event.selected;
      this.updateSelection({ targets });

      if (event.isDragStart) {
        event.inputEvent.preventDefault();
        setTimeout(() => {
          this.moveable!.dragStart(event.inputEvent);
        });
      }
    });
  };

  render() {
    return (
      <div key={this.revId} className={this.styles.wrap} style={this.style} ref={this.setRef}>
        {this.root.render()}
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  wrap: css`
    overflow: hidden;
    position: relative;
  `,

  toolbar: css`
    position: absolute;
    bottom: 0;
    margin: 10px;
  `,
}));
