import InfiniteViewer from 'infinite-viewer';
import Moveable from 'moveable';
import Selecto from 'selecto';

import { CONNECTION_ANCHOR_DIV_ID } from 'app/plugins/panel/canvas/components/connections/ConnectionAnchors';
import {
  CONNECTION_VERTEX_ID,
  CONNECTION_VERTEX_ADD_ID,
} from 'app/plugins/panel/canvas/components/connections/Connections';
import { getElementTransformAndDimensions } from 'app/plugins/panel/canvas/utils';

import { dimensionViewable, constraintViewable, settingsViewable } from './ables';
import { ElementState } from './element';
import { FrameState } from './frame';
import { Scene } from './scene';
import { findElementByTarget } from './sceneElementManagement';

// Helper function that disables custom able functionality
const disableCustomables = (moveable: Moveable) => {
  moveable!.props = {
    dimensionViewable: false,
    constraintViewable: false,
    settingsViewable: false,
  };
};

// Helper function that enables custom able functionality
const enableCustomables = (moveable: Moveable) => {
  moveable!.props = {
    dimensionViewable: true,
    constraintViewable: true,
    settingsViewable: true,
  };
};

/* 
  Helper function that determines if the selected DOM target is currently selected in selecto state.

  For context canvas elements each have a different level of nesting.
  Given this, we need to traverse up the DOM tree from the selected target to find
  the element's registered selecto div to determine if the selected target is already selected in selecto state.
  See `initMoveable` and `generateTargetElements` for more context.
*/
const isTargetAlreadySelected = (selectedTarget: HTMLElement, scene: Scene) => {
  let selectedTargetParent = selectedTarget.parentElement;
  let isTargetAlreadySelected = false;

  // Traverse up the DOM tree to check if the selected target is already selected
  while (selectedTargetParent) {
    // If the selected target is the scene's root element div, break the loop
    if (selectedTargetParent === scene.root.div) {
      break;
    }

    // Check if the selected target is already selected
    isTargetAlreadySelected = scene.selecto?.getSelectedTargets().includes(selectedTargetParent) ?? false;
    if (isTargetAlreadySelected) {
      break;
    }

    // Move up the DOM tree to the next parent element to check
    selectedTargetParent = selectedTargetParent.parentElement;
  }

  return isTargetAlreadySelected;
};

// Generate HTML element divs for every canvas element to configure selecto / moveable
const generateTargetElements = (rootElements: ElementState[]): HTMLDivElement[] => {
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

// Main entry point for initializing / updating moveable and selecto configuration
export const initMoveable = (destroySelecto = false, allowChanges = true, scene: Scene) => {
  const targetElements = generateTargetElements(scene.root.elements);

  if (destroySelecto && scene.selecto) {
    scene.selecto.destroy();
  }

  scene.selecto = new Selecto({
    rootContainer: scene.viewerDiv,
    dragContainer: scene.viewerDiv,
    selectableTargets: targetElements,
    toggleContinueSelect: 'shift',
    selectFromInside: false,
    hitRate: 0,
  });

  const snapDirections = { top: true, left: true, bottom: true, right: true, center: true, middle: true };
  const elementSnapDirections = { top: true, left: true, bottom: true, right: true, center: true, middle: true };

  scene.moveable = new Moveable(scene.viewportDiv!, {
    draggable: allowChanges && !scene.editModeEnabled.getValue(),
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

    ables: [dimensionViewable, constraintViewable(scene), settingsViewable(scene)],
    props: {
      dimensionViewable: allowChanges,
      constraintViewable: allowChanges,
      settingsViewable: allowChanges,
    },
    origin: false,
  })
    .on('rotateStart', () => {
      disableCustomables(scene.moveable!);
    })
    .on('rotate', (event) => {
      const targetedElement = findElementByTarget(event.target, scene.root.elements);

      if (targetedElement) {
        targetedElement.applyRotate(event);
      }
    })
    .on('rotateGroup', (e) => {
      for (let event of e.events) {
        const targetedElement = findElementByTarget(event.target, scene.root.elements);
        if (targetedElement) {
          targetedElement.applyRotate(event);
        }
      }
    })
    .on('rotateEnd', () => {
      enableCustomables(scene.moveable!);
      // Update the editor with the new rotation
      scene.moved.next(Date.now());
    })
    .on('click', (event) => {
      const targetedElement = findElementByTarget(event.target, scene.root.elements);
      let elementSupportsEditing = false;
      if (targetedElement) {
        elementSupportsEditing = targetedElement.item.hasEditMode ?? false;
      }

      if (event.isDouble && allowChanges && !scene.editModeEnabled.getValue() && elementSupportsEditing) {
        scene.editModeEnabled.next(true);
      }
    })
    .on('clickGroup', (event) => {
      scene.selecto!.clickTarget(event.inputEvent, event.inputTarget);
    })
    .on('dragStart', (event) => {
      scene.ignoreDataUpdate = true;
      scene.setNonTargetPointerEvents(event.target, true);

      // Remove the selected element from the snappable guidelines
      if (scene.moveable && scene.moveable.elementGuidelines) {
        const targetIndex = scene.moveable.elementGuidelines.indexOf(event.target);
        if (targetIndex > -1) {
          scene.moveable.elementGuidelines.splice(targetIndex, 1);
        }
      }
    })
    .on('dragGroupStart', (e) => {
      scene.ignoreDataUpdate = true;

      // Remove the selected elements from the snappable guidelines
      if (scene.moveable && scene.moveable.elementGuidelines) {
        for (let event of e.events) {
          const targetIndex = scene.moveable.elementGuidelines.indexOf(event.target);
          if (targetIndex > -1) {
            scene.moveable.elementGuidelines.splice(targetIndex, 1);
          }
        }
      }
    })
    .on('drag', (event) => {
      const targetedElement = findElementByTarget(event.target, scene.root.elements);
      if (targetedElement) {
        targetedElement.applyDrag(event);

        if (scene.connections.connectionsNeedUpdate(targetedElement) && scene.moveableActionCallback) {
          scene.moveableActionCallback(true);
        }
      }
    })
    .on('dragGroup', (e) => {
      let needsUpdate = false;
      for (let event of e.events) {
        const targetedElement = findElementByTarget(event.target, scene.root.elements);
        if (targetedElement) {
          targetedElement.applyDrag(event);
          if (!needsUpdate) {
            needsUpdate = scene.connections.connectionsNeedUpdate(targetedElement);
          }
        }
      }

      if (needsUpdate && scene.moveableActionCallback) {
        scene.moveableActionCallback(true);
      }
    })
    .on('dragGroupEnd', (e) => {
      e.events.forEach((event) => {
        const targetedElement = findElementByTarget(event.target, scene.root.elements);
        if (targetedElement) {
          const { top, left } = getElementTransformAndDimensions(targetedElement.div!);
          targetedElement.setPlacementFromGlobalCoordinates(left, top);

          // re-add the selected elements to the snappable guidelines
          if (scene.moveable && scene.moveable.elementGuidelines) {
            scene.moveable.elementGuidelines.push(event.target);
          }
        }
      });

      scene.moved.next(Date.now());
      scene.ignoreDataUpdate = false;
    })
    .on('dragEnd', (event) => {
      const targetedElement = findElementByTarget(event.target, scene.root.elements);
      if (targetedElement) {
        // targetedElement.setPlacementFromConstraint(undefined, undefined, scene.scale);
        // TODO: revisit this after implementing constraints system
        const { top, left } = getElementTransformAndDimensions(targetedElement.div!);
        targetedElement.setPlacementFromGlobalCoordinates(left, top);
      }

      scene.moved.next(Date.now());
      scene.ignoreDataUpdate = false;
      scene.setNonTargetPointerEvents(event.target, false);

      // re-add the selected element to the snappable guidelines
      if (scene.moveable && scene.moveable.elementGuidelines) {
        scene.moveable.elementGuidelines.push(event.target);
      }
    })
    .on('resizeStart', (event) => {
      const targetedElement = findElementByTarget(event.target, scene.root.elements);

      if (targetedElement) {
        // Remove the selected element from the snappable guidelines
        if (scene.moveable && scene.moveable.elementGuidelines) {
          const targetIndex = scene.moveable.elementGuidelines.indexOf(event.target);
          if (targetIndex > -1) {
            scene.moveable.elementGuidelines.splice(targetIndex, 1);
          }
        }

        const { top, left } = getElementTransformAndDimensions(targetedElement.div!);
        targetedElement.setPlacementFromGlobalCoordinates(left, top);
      }
    })
    .on('resizeGroupStart', (e) => {
      // Remove the selected elements from the snappable guidelines
      if (scene.moveable && scene.moveable.elementGuidelines) {
        for (let event of e.events) {
          const targetIndex = scene.moveable.elementGuidelines.indexOf(event.target);
          if (targetIndex > -1) {
            scene.moveable.elementGuidelines.splice(targetIndex, 1);
          }
        }
      }
    })
    .on('resize', (event) => {
      const targetedElement = findElementByTarget(event.target, scene.root.elements);
      if (targetedElement) {
        targetedElement.applyResize(event);

        if (scene.connections.connectionsNeedUpdate(targetedElement) && scene.moveableActionCallback) {
          scene.moveableActionCallback(true);
        }
      }
      scene.moved.next(Date.now()); // TODO only on end
    })
    .on('resizeGroup', (e) => {
      let needsUpdate = false;
      for (let event of e.events) {
        const targetedElement = findElementByTarget(event.target, scene.root.elements);
        if (targetedElement) {
          targetedElement.applyResize(event);

          if (!needsUpdate) {
            needsUpdate = scene.connections.connectionsNeedUpdate(targetedElement);
          }
        }
      }

      if (needsUpdate && scene.moveableActionCallback) {
        scene.moveableActionCallback(true);
      }

      scene.moved.next(Date.now()); // TODO only on end
    })
    .on('resizeEnd', (event) => {
      const targetedElement = findElementByTarget(event.target, scene.root.elements);

      if (targetedElement) {
        const { top, left } = getElementTransformAndDimensions(targetedElement.div!);
        targetedElement.setPlacementFromGlobalCoordinates(left, top);

        // re-add the selected element to the snappable guidelines
        if (scene.moveable && scene.moveable.elementGuidelines) {
          scene.moveable.elementGuidelines.push(event.target);
        }
      }
    })
    .on('resizeGroupEnd', (e) => {
      // re-add the selected elements to the snappable guidelines
      if (scene.moveable && scene.moveable.elementGuidelines) {
        for (let event of e.events) {
          scene.moveable.elementGuidelines.push(event.target);
        }
      }
    });

  let targets: Array<HTMLElement | SVGElement> = [];
  scene
    .selecto!.on('dragStart', (event) => {
      const selectedTarget = event.inputEvent.target;

      // If selected target is a connection control, eject to handle connection event
      if (selectedTarget.id === CONNECTION_ANCHOR_DIV_ID) {
        scene.connections.handleConnectionDragStart(selectedTarget, event.inputEvent.clientX, event.inputEvent.clientY);
        event.stop();
        return;
      }

      // If selected target is a vertex, eject to handle vertex event
      if (selectedTarget.id === CONNECTION_VERTEX_ID) {
        scene.connections.handleVertexDragStart(selectedTarget);
        event.stop();
        return;
      }

      // If selected target is an add vertex point, eject to handle add vertex event
      if (selectedTarget.id === CONNECTION_VERTEX_ADD_ID) {
        scene.connections.handleVertexAddDragStart(selectedTarget);
        event.stop();
        return;
      }

      const isTargetMoveableElement =
        scene.moveable!.isMoveableElement(selectedTarget) ||
        targets.some((target) => target === selectedTarget || target.contains(selectedTarget));

      const isElementSelected = isTargetAlreadySelected(selectedTarget, scene);

      // Apply grabbing cursor while dragging, applyLayoutStylesToDiv() resets it to grab when done
      if (
        scene.isEditingEnabled &&
        !scene.editModeEnabled.getValue() &&
        isTargetMoveableElement &&
        scene.selecto?.getSelectedTargets().length
      ) {
        scene.selecto.getSelectedTargets()[0].style.cursor = 'grabbing';
      }

      if (isTargetMoveableElement || isElementSelected || !scene.isEditingEnabled) {
        // Prevent drawing selection box when selected target is a moveable element or already selected
        event.stop();
      }
    })
    .on('select', () => {
      scene.editModeEnabled.next(false);

      // Hide connection anchors on select
      if (scene.connections.connectionAnchorDiv) {
        scene.connections.connectionAnchorDiv.style.display = 'none';
      }
    })
    .on('selectEnd', (event) => {
      targets = event.selected;
      scene.updateSelection({ targets });

      if (event.isDragStart) {
        if (scene.isEditingEnabled && !scene.editModeEnabled.getValue() && scene.selecto?.getSelectedTargets().length) {
          scene.selecto.getSelectedTargets()[0].style.cursor = 'grabbing';
        }
        event.inputEvent.preventDefault();
        event.data.timer = setTimeout(() => {
          scene.moveable!.dragStart(event.inputEvent);
        });
      }
    })
    .on('dragEnd', (event) => {
      clearTimeout(event.data.timer);
    });

  /******************/
  /* infiniteViewer */
  /******************/
  scene.infiniteViewer = new InfiniteViewer(scene.viewerDiv!, scene.viewportDiv!, {
    preventWheelClick: false,
    useAutoZoom: true,
    useMouseDrag: true,
    useWheelScroll: true,
  });

  // Handles context menu activation
  // Uses openContextMenu with coordinates when available (after CanvasContextMenu mounts), but
  // uses the basic visibility toggle when openContextMenu isn't ready (as a fallback)
  const triggerContextMenu = (x: number, y: number) => {
    if (scene.openContextMenu) {
      scene.openContextMenu({ x, y });
    } else {
      scene.contextMenuOnVisibilityChange(true);
    }
  };

  /* ----------------------------- EVENT HANDLERS ----------------------------- */
  // Right click
  scene.viewerDiv!.addEventListener('contextmenu', (e) => {
    if (e.ctrlKey && e.button === 2) {
      // Enable panning with Ctrl+right-click
      e.preventDefault();

      // Start tracking mouse movement for panning
      const startX = e.clientX;
      const startY = e.clientY;
      const startScrollLeft = scene.infiniteViewer!.getScrollLeft();
      const startScrollTop = scene.infiniteViewer!.getScrollTop();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = startX - moveEvent.clientX;
        const deltaY = startY - moveEvent.clientY;
        const scaleAdjustedDeltaX = deltaX / scene.scale;
        const scaleAdjustedDeltaY = deltaY / scene.scale;
        scene.infiniteViewer!.scrollTo(startScrollLeft + scaleAdjustedDeltaX, startScrollTop + scaleAdjustedDeltaY);
        moveEvent.preventDefault();
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      // Prevent default browser context menu
      e.preventDefault();
      triggerContextMenu(e.pageX, e.pageY);
    }
  });

  // Mouse scroll click
  // Only allow panning with middle mouse button (button 1)
  // Left click is reserved for selection/manipulation, right click for context menu
  scene.infiniteViewer!.on('dragStart', (e) => {
    if (e.inputEvent.button !== 1) {
      e.preventDefault();
      e.preventDrag();
    }
  });

  // Scroll
  scene.infiniteViewer!.on('scroll', () => {
    scene.updateConnectionsSize();
    scene.scale = scene.infiniteViewer!.getZoom();
  });
};
