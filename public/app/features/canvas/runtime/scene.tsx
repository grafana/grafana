import { css } from '@emotion/css';
import Moveable from 'moveable';
import React, { createRef, CSSProperties, RefObject } from 'react';
import { ReactZoomPanPinchContentRef } from 'react-zoom-pan-pinch';
import { BehaviorSubject, ReplaySubject, Subject, Subscription } from 'rxjs';
import Selecto from 'selecto';

import { AppEvents, PanelData } from '@grafana/data';
import { locationService } from '@grafana/runtime/src';
import {
  ColorDimensionConfig,
  ResourceDimensionConfig,
  ScalarDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from '@grafana/schema';
import { Portal } from '@grafana/ui';
import { config } from 'app/core/config';
import { CanvasFrameOptions, DEFAULT_CANVAS_ELEMENT_CONFIG } from 'app/features/canvas';
import { DimensionContext } from 'app/features/dimensions';
import {
  getColorDimensionFromData,
  getResourceDimensionFromData,
  getScalarDimensionFromData,
  getScaleDimensionFromData,
  getTextDimensionFromData,
} from 'app/features/dimensions/utils';
import { CanvasContextMenu } from 'app/plugins/panel/canvas/components/CanvasContextMenu';
import { CanvasTooltip } from 'app/plugins/panel/canvas/components/CanvasTooltip';
import { CONNECTION_ANCHOR_DIV_ID } from 'app/plugins/panel/canvas/components/connections/ConnectionAnchors';
import {
  Connections,
  CONNECTION_VERTEX_ADD_ID,
  CONNECTION_VERTEX_ID,
} from 'app/plugins/panel/canvas/components/connections/Connections';
import { AnchorPoint, CanvasTooltipPayload } from 'app/plugins/panel/canvas/types';
import { getParent, getTransformInstance } from 'app/plugins/panel/canvas/utils';

import appEvents from '../../../core/app_events';
import { CanvasPanel } from '../../../plugins/panel/canvas/CanvasPanel';
import { HorizontalConstraint, VerticalConstraint } from '../types';

import { SceneTransformWrapper } from './SceneTransformWrapper';
import { constraintViewable, dimensionViewable, settingsViewable } from './ables';
import { ElementState } from './element';
import { FrameState } from './frame';
import { RootElement } from './root';
import { findElementByTarget } from './sceneElementManagement';

export interface SelectionParams {
  targets: Array<HTMLElement | SVGElement>;
  frame?: FrameState;
}

export class Scene {
  styles = getStyles();
  readonly selection = new ReplaySubject<ElementState[]>(1);
  readonly moved = new Subject<number>(); // called after resize/drag for editor updates
  readonly byName = new Map<string, ElementState>();

  root: RootElement;

  revId = 0;

  width = 0;
  height = 0;
  scale = 1;
  style: CSSProperties = {};
  data?: PanelData;
  selecto?: Selecto;
  moveable?: Moveable;
  div?: HTMLDivElement;
  connections: Connections;
  currentLayer?: FrameState;
  isEditingEnabled?: boolean;
  shouldShowAdvancedTypes?: boolean;
  shouldPanZoom?: boolean;
  shouldInfinitePan?: boolean;
  skipNextSelectionBroadcast = false;
  ignoreDataUpdate = false;
  panel: CanvasPanel;
  contextMenuVisible?: boolean;
  contextMenuOnVisibilityChange = (visible: boolean) => {
    this.contextMenuVisible = visible;
    const transformInstance = getTransformInstance(this);
    if (transformInstance) {
      if (visible) {
        transformInstance.setup.disabled = true;
      } else {
        transformInstance.setup.disabled = false;
      }
    }
  };

  isPanelEditing = locationService.getSearchObject().editPanel !== undefined;

  inlineEditingCallback?: () => void;
  setBackgroundCallback?: (anchorPoint: AnchorPoint) => void;

  tooltipCallback?: (tooltip: CanvasTooltipPayload | undefined) => void;
  tooltip?: CanvasTooltipPayload;

  moveableActionCallback?: (moved: boolean) => void;

  readonly editModeEnabled = new BehaviorSubject<boolean>(false);
  subscription: Subscription;

  targetsToSelect = new Set<HTMLDivElement>();
  transformComponentRef: RefObject<ReactZoomPanPinchContentRef> | undefined;

  constructor(
    cfg: CanvasFrameOptions,
    enableEditing: boolean,
    showAdvancedTypes: boolean,
    panZoom: boolean,
    infinitePan: boolean,
    public onSave: (cfg: CanvasFrameOptions) => void,
    panel: CanvasPanel
  ) {
    this.root = this.load(cfg, enableEditing, showAdvancedTypes, panZoom, infinitePan);

    this.subscription = this.editModeEnabled.subscribe((open) => {
      if (!this.moveable || !this.isEditingEnabled) {
        return;
      }
      this.moveable.draggable = !open;
    });

    this.panel = panel;
    this.connections = new Connections(this);
    this.transformComponentRef = createRef();
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

  load(
    cfg: CanvasFrameOptions,
    enableEditing: boolean,
    showAdvancedTypes: boolean,
    panZoom: boolean,
    infinitePan: boolean
  ) {
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
    this.shouldPanZoom = panZoom;
    this.shouldInfinitePan = infinitePan;

    setTimeout(() => {
      if (this.div) {
        // If editing is enabled, clear selecto instance
        const destroySelecto = enableEditing;
        this.initMoveable(destroySelecto, enableEditing);
        this.currentLayer = this.root;
        this.selection.next([]);
        this.connections.select(undefined);
        this.connections.updateState();
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
    getPanelData: () => this.data,
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

  setNonTargetPointerEvents = (target: Element, disablePointerEvents: boolean) => {
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
      this.editModeEnabled.next(false);

      // Hide connection anchors on programmatic select
      if (this.connections.connectionAnchorDiv) {
        this.connections.connectionAnchorDiv.style.display = 'none';
      }
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
      const s = selection.targets.map((t) => findElementByTarget(t, this.root.elements)!);
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

  disableCustomables = () => {
    this.moveable!.props = {
      dimensionViewable: false,
      constraintViewable: false,
      settingsViewable: false,
    };
  };

  enableCustomables = () => {
    this.moveable!.props = {
      dimensionViewable: true,
      constraintViewable: true,
      settingsViewable: true,
    };
  };

  initMoveable = (destroySelecto = false, allowChanges = true) => {
    const targetElements = this.generateTargetElements(this.root.elements);

    if (destroySelecto && this.selecto) {
      this.selecto.destroy();
    }

    this.selecto = new Selecto({
      container: this.div,
      rootContainer: getParent(this),
      selectableTargets: targetElements,
      toggleContinueSelect: 'shift',
      selectFromInside: false,
      hitRate: 0,
    });

    const snapDirections = { top: true, left: true, bottom: true, right: true, center: true, middle: true };
    const elementSnapDirections = { top: true, left: true, bottom: true, right: true, center: true, middle: true };

    this.moveable = new Moveable(this.div!, {
      draggable: allowChanges && !this.editModeEnabled.getValue(),
      resizable: allowChanges,

      // Setup rotatable
      rotatable: allowChanges,
      throttleRotate: 5,
      rotationPosition: ['top', 'right'],

      // Setup snappable
      snappable: allowChanges,
      snapDirections: snapDirections,
      elementSnapDirections: elementSnapDirections,
      elementGuidelines: targetElements,

      ables: [dimensionViewable, constraintViewable(this), settingsViewable(this)],
      props: {
        dimensionViewable: allowChanges,
        constraintViewable: allowChanges,
        settingsViewable: allowChanges,
      },
      origin: false,
    })
      .on('rotateStart', () => {
        this.disableCustomables();
      })
      .on('rotate', (event) => {
        const targetedElement = findElementByTarget(event.target, this.root.elements);

        if (targetedElement) {
          targetedElement.applyRotate(event);
        }
      })
      .on('rotateGroup', (e) => {
        for (let event of e.events) {
          const targetedElement = findElementByTarget(event.target, this.root.elements);
          if (targetedElement) {
            targetedElement.applyRotate(event);
          }
        }
      })
      .on('rotateEnd', () => {
        this.enableCustomables();
        // Update the editor with the new rotation
        this.moved.next(Date.now());
      })
      .on('click', (event) => {
        const targetedElement = findElementByTarget(event.target, this.root.elements);
        let elementSupportsEditing = false;
        if (targetedElement) {
          elementSupportsEditing = targetedElement.item.hasEditMode ?? false;
        }

        if (event.isDouble && allowChanges && !this.editModeEnabled.getValue() && elementSupportsEditing) {
          this.editModeEnabled.next(true);
        }
      })
      .on('clickGroup', (event) => {
        this.selecto!.clickTarget(event.inputEvent, event.inputTarget);
      })
      .on('dragStart', (event) => {
        this.ignoreDataUpdate = true;
        this.setNonTargetPointerEvents(event.target, true);

        // Remove the selected element from the snappable guidelines
        if (this.moveable && this.moveable.elementGuidelines) {
          const targetIndex = this.moveable.elementGuidelines.indexOf(event.target);
          if (targetIndex > -1) {
            this.moveable.elementGuidelines.splice(targetIndex, 1);
          }
        }
      })
      .on('dragGroupStart', (e) => {
        this.ignoreDataUpdate = true;

        // Remove the selected elements from the snappable guidelines
        if (this.moveable && this.moveable.elementGuidelines) {
          for (let event of e.events) {
            const targetIndex = this.moveable.elementGuidelines.indexOf(event.target);
            if (targetIndex > -1) {
              this.moveable.elementGuidelines.splice(targetIndex, 1);
            }
          }
        }
      })
      .on('drag', (event) => {
        const targetedElement = findElementByTarget(event.target, this.root.elements);
        if (targetedElement) {
          targetedElement.applyDrag(event);

          if (this.connections.connectionsNeedUpdate(targetedElement) && this.moveableActionCallback) {
            this.moveableActionCallback(true);
          }
        }
      })
      .on('dragGroup', (e) => {
        let needsUpdate = false;
        for (let event of e.events) {
          const targetedElement = findElementByTarget(event.target, this.root.elements);
          if (targetedElement) {
            targetedElement.applyDrag(event);
            if (!needsUpdate) {
              needsUpdate = this.connections.connectionsNeedUpdate(targetedElement);
            }
          }
        }

        if (needsUpdate && this.moveableActionCallback) {
          this.moveableActionCallback(true);
        }
      })
      .on('dragGroupEnd', (e) => {
        e.events.forEach((event) => {
          const targetedElement = findElementByTarget(event.target, this.root.elements);
          if (targetedElement) {
            if (targetedElement) {
              targetedElement.setPlacementFromConstraint(undefined, undefined, this.scale);
            }

            // re-add the selected elements to the snappable guidelines
            if (this.moveable && this.moveable.elementGuidelines) {
              this.moveable.elementGuidelines.push(event.target);
            }
          }
        });

        this.moved.next(Date.now());
        this.ignoreDataUpdate = false;
      })
      .on('dragEnd', (event) => {
        const targetedElement = findElementByTarget(event.target, this.root.elements);
        if (targetedElement) {
          targetedElement.setPlacementFromConstraint(undefined, undefined, this.scale);
        }

        this.moved.next(Date.now());
        this.ignoreDataUpdate = false;
        this.setNonTargetPointerEvents(event.target, false);

        // re-add the selected element to the snappable guidelines
        if (this.moveable && this.moveable.elementGuidelines) {
          this.moveable.elementGuidelines.push(event.target);
        }
      })
      .on('resizeStart', (event) => {
        const targetedElement = findElementByTarget(event.target, this.root.elements);

        if (targetedElement) {
          // Remove the selected element from the snappable guidelines
          if (this.moveable && this.moveable.elementGuidelines) {
            const targetIndex = this.moveable.elementGuidelines.indexOf(event.target);
            if (targetIndex > -1) {
              this.moveable.elementGuidelines.splice(targetIndex, 1);
            }
          }

          targetedElement.tempConstraint = { ...targetedElement.options.constraint };
          targetedElement.options.constraint = {
            vertical: VerticalConstraint.Top,
            horizontal: HorizontalConstraint.Left,
          };
          targetedElement.setPlacementFromConstraint(undefined, undefined, this.scale);
        }
      })
      .on('resizeGroupStart', (e) => {
        // Remove the selected elements from the snappable guidelines
        if (this.moveable && this.moveable.elementGuidelines) {
          for (let event of e.events) {
            const targetIndex = this.moveable.elementGuidelines.indexOf(event.target);
            if (targetIndex > -1) {
              this.moveable.elementGuidelines.splice(targetIndex, 1);
            }
          }
        }
      })
      .on('resize', (event) => {
        const targetedElement = findElementByTarget(event.target, this.root.elements);
        if (targetedElement) {
          targetedElement.applyResize(event, this.scale);

          if (this.connections.connectionsNeedUpdate(targetedElement) && this.moveableActionCallback) {
            this.moveableActionCallback(true);
          }
        }
        this.moved.next(Date.now()); // TODO only on end
      })
      .on('resizeGroup', (e) => {
        let needsUpdate = false;
        for (let event of e.events) {
          const targetedElement = findElementByTarget(event.target, this.root.elements);
          if (targetedElement) {
            targetedElement.applyResize(event);

            if (!needsUpdate) {
              needsUpdate = this.connections.connectionsNeedUpdate(targetedElement);
            }
          }
        }

        if (needsUpdate && this.moveableActionCallback) {
          this.moveableActionCallback(true);
        }

        this.moved.next(Date.now()); // TODO only on end
      })
      .on('resizeEnd', (event) => {
        const targetedElement = findElementByTarget(event.target, this.root.elements);

        if (targetedElement) {
          if (targetedElement.tempConstraint) {
            targetedElement.options.constraint = targetedElement.tempConstraint;
            targetedElement.tempConstraint = undefined;
          }

          targetedElement.setPlacementFromConstraint(undefined, undefined, this.scale);

          // re-add the selected element to the snappable guidelines
          if (this.moveable && this.moveable.elementGuidelines) {
            this.moveable.elementGuidelines.push(event.target);
          }
        }
      })
      .on('resizeGroupEnd', (e) => {
        // re-add the selected elements to the snappable guidelines
        if (this.moveable && this.moveable.elementGuidelines) {
          for (let event of e.events) {
            this.moveable.elementGuidelines.push(event.target);
          }
        }
      });

    let targets: Array<HTMLElement | SVGElement> = [];
    this.selecto!.on('dragStart', (event) => {
      const selectedTarget = event.inputEvent.target;

      // If selected target is a connection control, eject to handle connection event
      if (selectedTarget.id === CONNECTION_ANCHOR_DIV_ID) {
        this.connections.handleConnectionDragStart(selectedTarget, event.inputEvent.clientX, event.inputEvent.clientY);
        event.stop();
        return;
      }

      // If selected target is a vertex, eject to handle vertex event
      if (selectedTarget.id === CONNECTION_VERTEX_ID) {
        this.connections.handleVertexDragStart(selectedTarget);
        event.stop();
        return;
      }

      // If selected target is an add vertex point, eject to handle add vertex event
      if (selectedTarget.id === CONNECTION_VERTEX_ADD_ID) {
        this.connections.handleVertexAddDragStart(selectedTarget);
        event.stop();
        return;
      }

      const isTargetMoveableElement =
        this.moveable!.isMoveableElement(selectedTarget) ||
        targets.some((target) => target === selectedTarget || target.contains(selectedTarget));

      const isTargetAlreadySelected = this.selecto
        ?.getSelectedTargets()
        .includes(selectedTarget.parentElement.parentElement);

      // Apply grabbing cursor while dragging, applyLayoutStylesToDiv() resets it to grab when done
      if (
        this.isEditingEnabled &&
        !this.editModeEnabled.getValue() &&
        isTargetMoveableElement &&
        this.selecto?.getSelectedTargets().length
      ) {
        this.selecto.getSelectedTargets()[0].style.cursor = 'grabbing';
      }

      if (isTargetMoveableElement || isTargetAlreadySelected || !this.isEditingEnabled) {
        // Prevent drawing selection box when selected target is a moveable element or already selected
        event.stop();
      }
    })
      .on('select', () => {
        this.editModeEnabled.next(false);

        // Hide connection anchors on select
        if (this.connections.connectionAnchorDiv) {
          this.connections.connectionAnchorDiv.style.display = 'none';
        }
      })
      .on('selectEnd', (event) => {
        targets = event.selected;
        this.updateSelection({ targets });

        if (event.isDragStart) {
          if (this.isEditingEnabled && !this.editModeEnabled.getValue() && this.selecto?.getSelectedTargets().length) {
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

  addToSelection = () => {
    try {
      let selection: SelectionParams = { targets: [] };
      selection.targets = [...this.targetsToSelect];
      this.select(selection);
    } catch (error) {
      appEvents.emit(AppEvents.alertError, ['Unable to add to selection']);
    }
  };

  render() {
    const isTooltipValid = (this.tooltip?.element?.data?.links?.length ?? 0) > 0;
    const canShowElementTooltip = !this.isEditingEnabled && isTooltipValid;

    const sceneDiv = (
      <div key={this.revId} className={this.styles.wrap} style={this.style} ref={this.setRef}>
        {this.connections.render()}
        {this.root.render()}
        {this.isEditingEnabled && (
          <Portal>
            <CanvasContextMenu
              scene={this}
              panel={this.panel}
              onVisibilityChange={this.contextMenuOnVisibilityChange}
            />
          </Portal>
        )}
        {canShowElementTooltip && (
          <Portal>
            <CanvasTooltip scene={this} />
          </Portal>
        )}
      </div>
    );

    return config.featureToggles.canvasPanelPanZoom ? (
      <SceneTransformWrapper scene={this}>{sceneDiv}</SceneTransformWrapper>
    ) : (
      sceneDiv
    );
  }
}

const getStyles = () => ({
  wrap: css({
    overflow: 'hidden',
    position: 'relative',
  }),
});
