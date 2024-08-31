import {
  SceneLayoutState,
  SceneObjectBase,
  SceneLayout,
  SceneComponentProps,
  SceneLayoutChildOptions,
  sceneGraph,
  SceneObjectState,
  VizPanel,
} from '@grafana/scenes';

import {
  VerticalConstraint,
  HorizontalConstraint,
  BackgroundImageSize,
  Constraint,
  CanvasElementPlacement,
} from './canvasTypes';

export interface CanvasElementState extends SceneObjectState {
  body: VizPanel;
  placement: CanvasElementPlacement;
}

export class CanvasElement extends SceneObjectBase<CanvasElementState> {
  public static Component = ({ model }: SceneComponentProps<CanvasElement>) => {
    const { body, placement } = model.useState();
    const layout = sceneGraph.getLayout(model);

    return (
      <div
        style={getItemStyles(placement)}
        key={body.state.key}
        className="selectable"
        ref={(v) => {
          // not pretty, but this lets us get back to the item directly
          // from dom events -- avoiding a complicated lookup by key
          if (v) {
            (v as any).__item = model;
          }
        }}
      >
        <body.Component model={body} />
      </div>
    );
  };
}

export function getItemStyles(placement: CanvasElementPlacement) {
  const editingEnabled = false;
  const disablePointerEvents = false;
  const vertical = placement.vertical ?? VerticalConstraint.Top;
  const horizontal = placement.horizontal ?? HorizontalConstraint.Left;

  const style: React.CSSProperties = {
    cursor: editingEnabled ? 'grab' : 'auto',
    pointerEvents: disablePointerEvents ? 'none' : 'auto',
    position: 'absolute',
    // Minimum element size is 10x10
    minWidth: '10px',
    minHeight: '10px',
  };

  const top = placement.top ?? 0;
  const left = placement.left ?? 0;
  const right = placement.right ?? 0;
  const height = placement.height ?? 100;
  const width = placement.width ?? 100;
  const bottom = placement.bottom ?? 0;

  const translate = ['0px', '0px'];

  switch (vertical) {
    case VerticalConstraint.Top:
      style.top = `${top}px`;
      style.height = `${height}px`;
      break;
    case VerticalConstraint.Bottom:
      style.bottom = `${bottom}px`;
      style.height = `${height}px`;
      break;
    case VerticalConstraint.TopBottom:
      style.top = `${top}px`;
      style.bottom = `${bottom}px`;
      style.height = '';
      break;
    case VerticalConstraint.Center:
      translate[1] = '-50%';
      style.top = `calc(50% - ${top}px)`;
      style.height = `${height}px`;
      break;
    case VerticalConstraint.Scale:
      style.top = `${top}%`;
      style.bottom = `${bottom}%`;
      style.height = '';
      break;
  }

  switch (horizontal) {
    case HorizontalConstraint.Left:
      style.left = `${left}px`;
      style.width = `${width}px`;
      break;
    case HorizontalConstraint.Right:
      style.right = `${right}px`;
      style.width = `${width}px`;
      break;
    case HorizontalConstraint.LeftRight:
      style.left = `${left}px`;
      style.right = `${right}px`;
      style.width = '';
      break;
    case HorizontalConstraint.Center:
      translate[0] = '-50%';
      style.left = `calc(50% - ${left}px)`;
      style.width = `${width}px`;
      break;
    case HorizontalConstraint.Scale:
      style.left = `${left}%`;
      style.right = `${right}%`;
      style.width = '';
      break;
  }

  style.transform = `translate(${translate[0]}, ${translate[1]})`;

  return style;
}
