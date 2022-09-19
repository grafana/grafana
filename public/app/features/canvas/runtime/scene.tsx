import { css } from '@emotion/css';
import Moveable from 'moveable';
import React, { CSSProperties } from 'react';
import { ReplaySubject, Subject } from 'rxjs';
import { first } from 'rxjs/operators';
import Selecto from 'selecto';

import { GrafanaTheme2, PanelData } from '@grafana/data';
import { locationService } from '@grafana/runtime/src';
import { Portal, stylesFactory } from '@grafana/ui';
import { config } from 'app/core/config';
import { CanvasFrameOptions, DEFAULT_CANVAS_ELEMENT_CONFIG } from 'app/features/canvas';
import {
  ColorDimensionConfig,
  DimensionContext,
  ResourceDimensionConfig,
  ScalarDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';
import {
  getColorDimensionFromData,
  getResourceDimensionFromData,
  getScalarDimensionFromData,
  getScaleDimensionFromData,
  getTextDimensionFromData,
} from 'app/features/dimensions/utils';
import { CanvasContextMenu } from 'app/plugins/panel/canvas/CanvasContextMenu';
import { LayerActionID } from 'app/plugins/panel/canvas/types';

import { HorizontalConstraint, Placement, VerticalConstraint } from '../types';

import { constraintViewable, dimensionViewable, settingsViewable } from './ables';
import { ElementState } from './element';
import { FrameState } from './frame';
import { RootElement } from './root';

export interface SelectionParams {
  targets: Array<HTMLElement | SVGElement>;
  frame?: FrameState;
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
  currentLayer?: FrameState;
  isEditingEnabled?: boolean;
  shouldShowAdvancedTypes?: boolean;
  skipNextSelectionBroadcast = false;
  ignoreDataUpdate = false;

  isPanelEditing = locationService.getSearchObject().editPanel !== undefined;

  inlineEditingCallback?: () => void;

  constructor(
    cfg: CanvasFrameOptions,
    enableEditing: boolean,
    showAdvancedTypes: boolean,
    public onSave: (cfg: CanvasFrameOptions) => void
  ) {
    this.root = this.load(cfg, enableEditing, showAdvancedTypes);
  }

  getNextElementName = (isFrame = false) => {
    const label = isFrame ? 'Frame' : 'Element';
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

  load(cfg: CanvasFrameOptions, enableEditing: boolean, showAdvancedTypes: boolean) {
    this.root = new RootElement(
      cfg ?? {
        type: 'frame',
        elements: [DEFAULT_CANVAS_ELEMENT_CONFIG],
      },
      this,
      this.save // callback when changes are made
    );

    this.isEditingEnabled = enableEditing;
    this.shouldShowAdvancedTypes = showAdvancedTypes;

    setTimeout(() => {
      if (this.div) {
        // If editing is enabled, clear selecto instance
        const destroySelecto = enableEditing;
        this.initMoveable(destroySelecto, enableEditing);
        this.currentLayer = this.root;
        this.selection.next([]);
      }
    });
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

  frameSelection() {
    this.selection.pipe(first()).subscribe((currentSelectedElements) => {
      const currentLayer = currentSelectedElements[0].parent!;

      const newLayer = new FrameState(
        {
          type: 'frame',
          name: this.getNextElementName(true),
          elements: [],
        },
        this,
        currentSelectedElements[0].parent
      );

      const framePlacement = this.generateFrameContainer(currentSelectedElements);

      newLayer.options.placement = framePlacement;

      currentSelectedElements.forEach((element: ElementState) => {
        const elementContainer = element.div?.getBoundingClientRect();
        element.setPlacementFromConstraint(elementContainer, framePlacement as DOMRect);
        currentLayer.doAction(LayerActionID.Delete, element);
        newLayer.doAction(LayerActionID.Duplicate, element, false, false);
      });

      newLayer.setPlacementFromConstraint(framePlacement as DOMRect, currentLayer.div?.getBoundingClientRect());

      currentLayer.elements.push(newLayer);

      this.byName.set(newLayer.getName(), newLayer);

      this.save();
    });
  }

  private generateFrameContainer = (elements: ElementState[]): Placement => {
    let minTop = Infinity;
    let minLeft = Infinity;
    let maxRight = 0;
    let maxBottom = 0;

    elements.forEach((element: ElementState) => {
      const elementContainer = element.div?.getBoundingClientRect();

      if (!elementContainer) {
        return;
      }

      if (minTop > elementContainer.top) {
        minTop = elementContainer.top;
      }

      if (minLeft > elementContainer.left) {
        minLeft = elementContainer.left;
      }

      if (maxRight < elementContainer.right) {
        maxRight = elementContainer.right;
      }

      if (maxBottom < elementContainer.bottom) {
        maxBottom = elementContainer.bottom;
      }
    });

    return {
      top: minTop,
      left: minLeft,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
    };
  };

  clearCurrentSelection(skipNextSelectionBroadcast = false) {
    this.skipNextSelectionBroadcast = skipNextSelectionBroadcast;
    let event: MouseEvent = new MouseEvent('click');
    this.selecto?.clickTarget(event, this.div);
  }

  updateCurrentLayer(newLayer: FrameState) {
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
      });
    }
  };

  findElementByTarget = (target: HTMLElement | SVGElement): ElementState | undefined => {
    // We will probably want to add memoization to this as we are calling on drag / resize

    const stack = [...this.root.elements];
    while (stack.length > 0) {
      const currentElement = stack.shift();

      if (currentElement && currentElement.div && currentElement.div === target) {
        return currentElement;
      }

      const nestedElements = currentElement instanceof FrameState ? currentElement.elements : [];
      for (const nestedElement of nestedElements) {
        stack.unshift(nestedElement);
      }
    }

    return undefined;
  };

  setNonTargetPointerEvents = (target: HTMLElement | SVGElement, disablePointerEvents: boolean) => {
    const stack = [...this.root.elements];
    while (stack.length > 0) {
      const currentElement = stack.shift();

      if (currentElement && currentElement.div && currentElement.div !== target) {
        currentElement.applyLayoutStylesToDiv(disablePointerEvents);
      }

      const nestedElements = currentElement instanceof FrameState ? currentElement.elements : [];
      for (const nestedElement of nestedElements) {
        stack.unshift(nestedElement);
      }
    }
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
    if (this.skipNextSelectionBroadcast) {
      this.skipNextSelectionBroadcast = false;
      return;
    }

    if (selection.frame) {
      this.selection.next([selection.frame]);
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

      const nestedElements = currentElement instanceof FrameState ? currentElement.elements : [];
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
      rootContainer: this.div,
      selectableTargets: targetElements,
      toggleContinueSelect: 'shift',
      selectFromInside: false,
      hitRate: 0,
    });

    this.moveable = new Moveable(this.div!, {
      draggable: allowChanges,
      resizable: allowChanges,
      ables: [dimensionViewable, constraintViewable(this), settingsViewable(this)],
      props: {
        dimensionViewable: allowChanges,
        constraintViewable: allowChanges,
        settingsViewable: allowChanges,
      },
      origin: false,
      className: this.styles.selected,
    })
      .on('clickGroup', (event) => {
        this.selecto!.clickTarget(event.inputEvent, event.inputTarget);
      })
      .on('dragStart', (event) => {
        this.ignoreDataUpdate = true;
        this.setNonTargetPointerEvents(event.target, true);
      })
      .on('dragGroupStart', (event) => {
        this.ignoreDataUpdate = true;
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
      .on('dragGroupEnd', (e) => {
        e.events.forEach((event) => {
          const targetedElement = this.findElementByTarget(event.target);
          if (targetedElement) {
            targetedElement.setPlacementFromConstraint();
          }
        });

        this.moved.next(Date.now());
        this.ignoreDataUpdate = false;
      })
      .on('dragEnd', (event) => {
        const targetedElement = this.findElementByTarget(event.target);
        if (targetedElement) {
          targetedElement.setPlacementFromConstraint();
        }

        this.moved.next(Date.now());
        this.ignoreDataUpdate = false;
        this.setNonTargetPointerEvents(event.target, false);
      })
      .on('resizeStart', (event) => {
        const targetedElement = this.findElementByTarget(event.target);

        if (targetedElement) {
          targetedElement.tempConstraint = { ...targetedElement.options.constraint };
          targetedElement.options.constraint = {
            vertical: VerticalConstraint.Top,
            horizontal: HorizontalConstraint.Left,
          };
          targetedElement.setPlacementFromConstraint();
        }
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
          if (targetedElement.tempConstraint) {
            targetedElement.options.constraint = targetedElement.tempConstraint;
            targetedElement.tempConstraint = undefined;
          }

          targetedElement.setPlacementFromConstraint();
        }
      });

    let targets: Array<HTMLElement | SVGElement> = [];
    this.selecto!.on('dragStart', (event) => {
      const selectedTarget = event.inputEvent.target;

      const isTargetMoveableElement =
        this.moveable!.isMoveableElement(selectedTarget) ||
        targets.some((target) => target === selectedTarget || target.contains(selectedTarget));

      const isTargetAlreadySelected = this.selecto
        ?.getSelectedTargets()
        .includes(selectedTarget.parentElement.parentElement);

      // Apply grabbing cursor while dragging, applyLayoutStylesToDiv() resets it to grab when done
      if (this.isEditingEnabled && isTargetMoveableElement && this.selecto?.getSelectedTargets().length) {
        this.selecto.getSelectedTargets()[0].style.cursor = 'grabbing';
      }

      if (isTargetMoveableElement || isTargetAlreadySelected) {
        // Prevent drawing selection box when selected target is a moveable element or already selected
        event.stop();
      }
    })
      .on('selectEnd', (event) => {
        targets = event.selected;
        this.updateSelection({ targets });

        if (event.isDragStart) {
          if (this.isEditingEnabled && this.selecto?.getSelectedTargets().length) {
            this.selecto.getSelectedTargets()[0].style.cursor = 'grabbing';
          }
          event.inputEvent.preventDefault();
          event.data.timer = setTimeout(() => {
            this.moveable!.dragStart(event.inputEvent);
          });
        }
      })
      .on('dragEnd', (event) => {
        clearTimeout(event.data.timer);
      });
  };

  reorderElements = (src: ElementState, dest: ElementState, dragToGap: boolean, destPosition: number) => {
    switch (dragToGap) {
      case true:
        switch (destPosition) {
          case -1:
            // top of the tree
            if (src.parent instanceof FrameState) {
              // move outside the frame
              if (dest.parent) {
                this.updateElements(src, dest.parent, dest.parent.elements.length);
                src.updateData(dest.parent.scene.context);
              }
            } else {
              dest.parent?.reorderTree(src, dest, true);
            }
            break;
          default:
            if (dest.parent) {
              this.updateElements(src, dest.parent, dest.parent.elements.indexOf(dest));
              src.updateData(dest.parent.scene.context);
            }
            break;
        }
        break;
      case false:
        if (dest instanceof FrameState) {
          if (src.parent === dest) {
            // same frame parent
            src.parent?.reorderTree(src, dest, true);
          } else {
            this.updateElements(src, dest);
            src.updateData(dest.scene.context);
          }
        } else if (src.parent === dest.parent) {
          src.parent?.reorderTree(src, dest);
        } else {
          if (dest.parent) {
            this.updateElements(src, dest.parent);
            src.updateData(dest.parent.scene.context);
          }
        }
        break;
    }
  };

  private updateElements = (src: ElementState, dest: FrameState | RootElement, idx: number | null = null) => {
    src.parent?.doAction(LayerActionID.Delete, src);
    src.parent = dest;

    const elementContainer = src.div?.getBoundingClientRect();
    src.setPlacementFromConstraint(elementContainer, dest.div?.getBoundingClientRect());

    const destIndex = idx ?? dest.elements.length - 1;
    dest.elements.splice(destIndex, 0, src);
    dest.scene.save();

    dest.reinitializeMoveable();
  };

  render() {
    const canShowContextMenu = this.isPanelEditing || (!this.isPanelEditing && this.isEditingEnabled);

    return (
      <div key={this.revId} className={this.styles.wrap} style={this.style} ref={this.setRef}>
        {this.root.render()}
        {canShowContextMenu && (
          <Portal>
            <CanvasContextMenu scene={this} />
          </Portal>
        )}
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  wrap: css`
    overflow: hidden;
    position: relative;
  `,
  selected: css`
    z-index: 999 !important;
  `,
}));
