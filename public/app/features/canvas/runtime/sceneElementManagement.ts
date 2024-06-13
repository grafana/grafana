import { first } from 'rxjs/operators';

import { Placement } from 'app/plugins/panel/canvas/panelcfg.gen';
import { LayerActionID } from 'app/plugins/panel/canvas/types';

import { ElementState } from './element';
import { FrameState } from './frame';
import { RootElement } from './root';
import { Scene } from './scene';

// TODO: Consider whether or not reorderElements + updateElements should be moved to TreeNavigationEditor
// Reorder elements in the DOM when rearranging them in the tree navigation editor
export const reorderElements = (src: ElementState, dest: ElementState, dragToGap: boolean, destPosition: number) => {
  switch (dragToGap) {
    case true:
      switch (destPosition) {
        case -1:
          // top of the tree
          if (src.parent instanceof FrameState) {
            // move outside the frame
            if (dest.parent) {
              updateElements(src, dest.parent, dest.parent.elements.length);
              src.updateData(dest.parent.scene.context);
            }
          } else {
            dest.parent?.reorderTree(src, dest, true);
          }
          break;
        default:
          if (dest.parent) {
            updateElements(src, dest.parent, dest.parent.elements.indexOf(dest));
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
          updateElements(src, dest);
          src.updateData(dest.scene.context);
        }
      } else if (src.parent === dest.parent) {
        src.parent?.reorderTree(src, dest);
      } else {
        if (dest.parent) {
          updateElements(src, dest.parent);
          src.updateData(dest.parent.scene.context);
        }
      }
      break;
  }
};

// Reorders canvas elements
const updateElements = (src: ElementState, dest: FrameState | RootElement, idx: number | null = null) => {
  src.parent?.doAction(LayerActionID.Delete, src);
  src.parent = dest;

  const elementContainer = src.div?.getBoundingClientRect();
  src.setPlacementFromConstraint(elementContainer, dest.div?.getBoundingClientRect());

  const destIndex = idx ?? dest.elements.length - 1;
  dest.elements.splice(destIndex, 0, src);
  dest.scene.save();

  dest.reinitializeMoveable();
};

// Finds the element state if it exists for a given DOM element
export const findElementByTarget = (target: Element, sceneElements: ElementState[]): ElementState | undefined => {
  // We will probably want to add memoization to this as we are calling on drag / resize

  const stack = [...sceneElements];
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

// Nest selected elements into a frame object
export const frameSelection = (scene: Scene) => {
  scene.selection.pipe(first()).subscribe((currentSelectedElements) => {
    const currentLayer = currentSelectedElements[0].parent!;

    const newLayer = new FrameState(
      {
        type: 'frame',
        name: scene.getNextElementName(true),
        elements: [],
      },
      scene,
      currentSelectedElements[0].parent
    );

    const framePlacement = generateFrameContainer(currentSelectedElements);

    newLayer.options.placement = framePlacement;

    currentSelectedElements.forEach((element: ElementState) => {
      const elementContainer = element.div?.getBoundingClientRect();

      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      element.setPlacementFromConstraint(elementContainer, framePlacement as DOMRect);
      currentLayer.doAction(LayerActionID.Delete, element);
      newLayer.doAction(LayerActionID.Duplicate, element, false, false);
    });

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    newLayer.setPlacementFromConstraint(framePlacement as DOMRect, currentLayer.div?.getBoundingClientRect());

    currentLayer.elements.push(newLayer);

    scene.byName.set(newLayer.getName(), newLayer);

    scene.save();
  });
};

// Helper function to generate the a frame object based on the selected elements' dimensions
const generateFrameContainer = (elements: ElementState[]): Placement => {
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
