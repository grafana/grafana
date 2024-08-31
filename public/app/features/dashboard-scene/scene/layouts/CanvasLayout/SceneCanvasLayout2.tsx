import Moveable from 'moveable';
import { CSSProperties } from 'react';
import { OnEvent, OnResize } from 'react-moveable/declaration/types';
import Selecto from 'selecto';

import {
  SceneLayoutState,
  SceneLayoutChildOptions,
  SceneObjectBase,
  SceneLayout,
  SceneComponentProps,
} from '@grafana/scenes';

import { CanvasElement, getItemStyles } from './SceneCanvasElement';
import { CanvasElementPlacement, HorizontalConstraint, VerticalConstraint } from './canvasTypes';

interface SceneCanvasLayoutRootState extends SceneLayoutState {
  children: CanvasElement[];
}

export class SceneCanvasRootLayout extends SceneObjectBase<SceneCanvasLayoutRootState> implements SceneLayout {
  public static Component = CanvasLayoutRenderer;

  public moveable?: Moveable;
  public selecto?: Selecto;

  public isDraggable(): boolean {
    return false;
  }

  public initializeMoveable(container: HTMLDivElement) {
    if (!container) {
      return;
    }

    let resizingTempPlacement: CanvasElementPlacement | undefined = undefined;

    const allowChanges = true;

    const selecto = new Selecto({
      container: container,
      rootContainer: container,
      selectableTargets: ['.selectable'],
      toggleContinueSelect: 'shift',
      selectFromInside: false,
      hitRate: 0,
    });

    const moveable = new Moveable(container, {
      draggable: allowChanges,
      resizable: allowChanges,
      origin: false,
    })
      .on('drag', (event) => {
        event.target.style.transform = event.transform;
      })
      .on('dragGroup', (e) => {
        for (let event of e.events) {
          event.target.style.transform = event.transform;
        }
      })
      .on('dragEnd', (event) => {
        const item = getCanvasElement(event);
        if (!item) {
          return;
        }

        const placement = calculatePositionFromDOM(event.target, item.state.placement);
        event.target.style.transform = 'none';
        item.setState({ placement });
      })
      .on('dragGroupEnd', (e) => {
        for (let event of e.events) {
          const item = getCanvasElement(event);
          if (!item) {
            return;
          }

          const placement = calculatePositionFromDOM(event.target, item.state.placement);
          event.target.style.transform = 'none';

          item.setState({ placement });
        }
      })
      .on('resizeStart', (event) => {
        const item = getCanvasElement(event);
        if (!item) {
          return;
        }

        resizingTempPlacement = calculatePositionFromDOM(event.target, {
          vertical: VerticalConstraint.Top,
          horizontal: HorizontalConstraint.Left,
        });

        const styles = getItemStyles(resizingTempPlacement);

        event.target.style.removeProperty('bottom');
        event.target.style.removeProperty('right');

        for (const key in styles) {
          event.target.style[key as any] = (styles as any)[key];
        }
      })
      .on('resize', (event) => {
        const item = getCanvasElement(event);
        if (!item) {
          return;
        }

        applyResize(event, resizingTempPlacement!);
      })
      .on('resizeEnd', (event) => {
        const item = getCanvasElement(event);
        if (!item) {
          return;
        }

        const placement = calculatePositionFromDOM(event.target, item.state.placement);
        item.setState({ placement });

        resizingTempPlacement = undefined;
      });

    let targets: Array<HTMLElement | SVGElement> = [];
    selecto
      .on('dragStart', (event) => {
        const selectedTarget = event.inputEvent.target;

        const isTargetMoveableElement =
          moveable.isMoveableElement(selectedTarget) ||
          targets.some((target) => target === selectedTarget || target.contains(selectedTarget));

        const isTargetAlreadySelected = selecto
          ?.getSelectedTargets()
          .includes(selectedTarget.parentElement.parentElement);

        if (isTargetMoveableElement || isTargetAlreadySelected || !allowChanges) {
          // Prevent drawing selection box when selected target is a moveable element or already selected
          event.stop();
        }
      })
      .on('selectEnd', (event) => {
        targets = event.selected;
        moveable.target = event.selected;
        if (event.isDragStart) {
          event.inputEvent.preventDefault();
          event.data.timer = setTimeout(() => {
            moveable!.dragStart(event.inputEvent);
          });
        }
      })
      .on('dragEnd', (event) => {
        clearTimeout(event.data.timer);
      });

    this.moveable = moveable;
    this.selecto = selecto;
  }
}

function CanvasLayoutRenderer({ model }: SceneComponentProps<SceneCanvasRootLayout>) {
  const { children } = model.useState();
  const style: CSSProperties = {
    flexGrow: 1,
    flexDirection: 'row',
    display: 'flex',
    gap: '8px',
    alignContent: 'baseline',
    position: 'relative',
  };

  return (
    <>
      <div style={style} ref={(el) => el && model.initializeMoveable(el)}>
        {children.map((item) => {
          return <item.Component model={item} key={item.state.key} />;
        })}
      </div>
    </>
  );
}

function getCanvasElement(e: OnEvent): CanvasElement | undefined {
  return (e.target as any)?.__item as CanvasElement;
}

function calculatePositionFromDOM(
  element: HTMLElement | SVGElement,
  initialPlacement: CanvasElementPlacement
): CanvasElementPlacement {
  let parentBorderWidth = 0;
  const elementContainer = element.getBoundingClientRect();
  // TODO: Create function to reach to the root (due to nesting)
  const parentContainer = element.parentElement?.parentElement?.parentElement?.getBoundingClientRect();

  // TODO: maybe needed?
  // if (!parentContainer) {
  //   parentContainer = this.div && this.div.parentElement?.getBoundingClientRect();
  // parentBorderWidth = parseFloat(getComputedStyle(element.parentElement!).borderWidth);
  // }

  const relativeTop =
    elementContainer && parentContainer
      ? Math.round(elementContainer.top - parentContainer.top - parentBorderWidth)
      : 0;
  const relativeBottom =
    elementContainer && parentContainer
      ? Math.round(parentContainer.bottom - parentBorderWidth - elementContainer.bottom)
      : 0;
  const relativeLeft =
    elementContainer && parentContainer
      ? Math.round(elementContainer.left - parentContainer.left - parentBorderWidth)
      : 0;
  const relativeRight =
    elementContainer && parentContainer
      ? Math.round(parentContainer.right - parentBorderWidth - elementContainer.right)
      : 0;

  const placement = { ...initialPlacement } as CanvasElementPlacement;
  const vertical = initialPlacement.vertical ?? VerticalConstraint.Top;
  const horizontal = initialPlacement.horizontal ?? HorizontalConstraint.Left;

  const width = elementContainer?.width ?? 100;
  const height = elementContainer?.height ?? 100;

  switch (vertical) {
    case VerticalConstraint.Top:
      placement.top = relativeTop;
      placement.height = height;
      break;
    case VerticalConstraint.Bottom:
      placement.bottom = relativeBottom;
      placement.height = height;
      break;
    case VerticalConstraint.TopBottom:
      placement.top = relativeTop;
      placement.bottom = relativeBottom;
      break;
    case VerticalConstraint.Center:
      const elementCenter = elementContainer ? relativeTop + height / 2 : 0;
      const parentCenter = parentContainer ? parentContainer.height / 2 : 0;
      const distanceFromCenter = parentCenter - elementCenter;
      placement.top = distanceFromCenter;
      placement.height = height;
      break;
    case VerticalConstraint.Scale:
      placement.top = (relativeTop / (parentContainer?.height ?? height)) * 100;
      placement.bottom = (relativeBottom / (parentContainer?.height ?? height)) * 100;
      break;
  }

  switch (horizontal) {
    case HorizontalConstraint.Left:
      placement.left = relativeLeft;
      placement.width = width;
      break;
    case HorizontalConstraint.Right:
      placement.right = relativeRight;
      placement.width = width;
      break;
    case HorizontalConstraint.LeftRight:
      placement.left = relativeLeft;
      placement.right = relativeRight;
      break;
    case HorizontalConstraint.Center:
      const elementCenter = elementContainer ? relativeLeft + width / 2 : 0;
      const parentCenter = parentContainer ? parentContainer.width / 2 : 0;
      const distanceFromCenter = parentCenter - elementCenter;
      placement.left = distanceFromCenter;
      placement.width = width;
      break;
    case HorizontalConstraint.Scale:
      placement.left = (relativeLeft / (parentContainer?.width ?? width)) * 100;
      placement.right = (relativeRight / (parentContainer?.width ?? width)) * 100;
      break;
  }

  return placement;
}

function applyResize(event: OnResize, placement: CanvasElementPlacement) {
  const style = event.target.style;
  const deltaX = event.delta[0];
  const deltaY = event.delta[1];
  const dirLR = event.direction[0];
  const dirTB = event.direction[1];

  if (dirLR === 1) {
    placement.width = event.width;
    style.width = `${placement.width}px`;
  } else if (dirLR === -1) {
    placement.left! -= deltaX;
    placement.width = event.width;
    style.left = `${placement.left}px`;
    style.width = `${placement.width}px`;
  }

  if (dirTB === -1) {
    placement.top! -= deltaY;
    placement.height = event.height;
    style.top = `${placement.top}px`;
    style.height = `${placement.height}px`;
  } else if (dirTB === 1) {
    placement.height = event.height;
    style.height = `${placement.height}px`;
  }
}
