import { MoveableManagerInterface, Renderer } from 'moveable';

import { HorizontalConstraint, VerticalConstraint } from '../types';

import { Scene } from './scene';

export const dimensionViewable = {
  name: 'dimensionViewable',
  props: {},
  events: {},
  render(moveable: MoveableManagerInterface<any, any>, React: Renderer) {
    const rect = moveable.getRect();
    return (
      <div
        key={'dimension-viewable'}
        className={'moveable-dimension'}
        style={{
          position: 'absolute',
          left: `${rect.width / 2}px`,
          top: `${rect.height + 20}px`,
          background: '#4af',
          borderRadius: '2px',
          padding: '2px 4px',
          color: 'white',
          fontSize: '13px',
          whiteSpace: 'nowrap',
          fontWeight: 'bold',
          willChange: 'transform',
          transform: 'translate(-50%, 0px)',
          zIndex: 100,
        }}
      >
        {Math.round(rect.offsetWidth)} x {Math.round(rect.offsetHeight)}
      </div>
    );
  },
};

export const constraintViewable = (scene: Scene) => ({
  name: 'constraintViewable',
  props: {},
  events: {},
  render(moveable: MoveableManagerInterface<any, any>, React: Renderer) {
    const rect = moveable.getRect();
    const targetElement = scene.findElementByTarget(moveable.state.target);

    // If target is currently in motion or selection is more than 1 element don't display constraint visualizations
    if (
      targetElement?.isMoving ||
      (scene.selecto?.getSelectedTargets() && scene.selecto?.getSelectedTargets().length > 1)
    ) {
      return;
    }

    let verticalConstraintVisualization = null;
    let horizontalConstraintVisualization = null;

    const constraint = targetElement?.tempConstraint ?? targetElement?.options.constraint ?? {};

    const borderStyle = '1px dashed #4af';

    const centerIndicatorLineOne = React.createElement('div', {
      style: {
        position: 'absolute',
        left: `${rect.width / 2}px`,
        top: `${rect.height / 2 - rect.height / 16}px`,
        borderLeft: borderStyle,
        height: `${rect.height / 8}px`,
        transform: 'rotate(45deg)',
      },
    });

    const centerIndicatorLineTwo = React.createElement('div', {
      style: {
        position: 'absolute',
        left: `${rect.width / 2}px`,
        top: `${rect.height / 2 - rect.height / 16}px`,
        borderLeft: borderStyle,
        height: `${rect.height / 8}px`,
        transform: 'rotate(-45deg)',
      },
    });

    const centerIndicator = React.createElement('div', {}, [centerIndicatorLineOne, centerIndicatorLineTwo]);

    const verticalConstraintTop = React.createElement('div', {
      style: {
        position: 'absolute',
        left: `${rect.width / 2}px`,
        bottom: '0px',
        borderLeft: borderStyle,
        height: '100vh',
      },
    });

    const verticalConstraintBottom = React.createElement('div', {
      style: {
        position: 'absolute',
        left: `${rect.width / 2}px`,
        top: `${rect.height}px`,
        borderLeft: borderStyle,
        height: '100vh',
      },
    });

    const verticalConstraintTopBottom = React.createElement('div', {}, [
      verticalConstraintTop,
      verticalConstraintBottom,
    ]);

    const verticalConstraintCenterLine = React.createElement('div', {
      style: {
        position: 'absolute',
        left: `${rect.width / 2}px`,
        top: `${rect.height / 4}px`,
        borderLeft: borderStyle,
        height: `${rect.height / 2}px`,
      },
    });

    const verticalConstraintCenter = React.createElement('div', {}, [verticalConstraintCenterLine, centerIndicator]);

    switch (constraint.vertical) {
      case VerticalConstraint.Top:
        verticalConstraintVisualization = verticalConstraintTop;
        break;
      case VerticalConstraint.Bottom:
        verticalConstraintVisualization = verticalConstraintBottom;
        break;
      case VerticalConstraint.TopBottom:
        verticalConstraintVisualization = verticalConstraintTopBottom;
        break;
      case VerticalConstraint.Center:
        verticalConstraintVisualization = verticalConstraintCenter;
        break;
    }

    const horizontalConstraintLeft = React.createElement('div', {
      style: {
        position: 'absolute',
        right: '0px',
        top: `${rect.height / 2}px`,
        borderTop: borderStyle,
        width: '100vw',
      },
    });

    const horizontalConstraintRight = React.createElement('div', {
      style: {
        position: 'absolute',
        left: `${rect.width}px`,
        top: `${rect.height / 2}px`,
        borderTop: borderStyle,
        width: '100vw',
      },
    });

    const horizontalConstraintLeftRight = React.createElement('div', {}, [
      horizontalConstraintLeft,
      horizontalConstraintRight,
    ]);

    const horizontalConstraintCenterLine = React.createElement('div', {
      style: {
        position: 'absolute',
        left: `${rect.width / 4}px`,
        top: `${rect.height / 2}px`,
        borderTop: borderStyle,
        width: `${rect.width / 2}px`,
      },
    });

    const horizontalConstraintCenter = React.createElement('div', {}, [
      horizontalConstraintCenterLine,
      centerIndicator,
    ]);

    switch (constraint.horizontal) {
      case HorizontalConstraint.Left:
        horizontalConstraintVisualization = horizontalConstraintLeft;
        break;
      case HorizontalConstraint.Right:
        horizontalConstraintVisualization = horizontalConstraintRight;
        break;
      case HorizontalConstraint.LeftRight:
        horizontalConstraintVisualization = horizontalConstraintLeftRight;
        break;
      case HorizontalConstraint.Center:
        horizontalConstraintVisualization = horizontalConstraintCenter;
        break;
    }

    const constraintVisualization = React.createElement('div', {}, [
      verticalConstraintVisualization,
      horizontalConstraintVisualization,
    ]);

    return constraintVisualization;
  },
});
