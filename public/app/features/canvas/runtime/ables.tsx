import { MoveableManagerInterface, Renderer } from 'moveable';

import { VerticalConstraint, HorizontalConstraint } from 'app/plugins/panel/canvas/panelcfg.gen';

import { Scene } from './scene';
import { findElementByTarget } from './sceneElementManagement';

export const settingsViewable = (scene: Scene) => ({
  name: 'settingsViewable',
  props: [],
  events: [],
  render(moveable: MoveableManagerInterface<unknown, unknown>, React: Renderer) {
    // If selection is more than 1 element don't display settings button
    if (scene.selecto?.getSelectedTargets() && scene.selecto?.getSelectedTargets().length > 1) {
      return;
    }

    const openSettings = (x: number, y: number) => {
      const container = moveable.getContainer();
      const evt = new PointerEvent('contextmenu', { clientX: x, clientY: y });
      container.dispatchEvent(evt);
    };

    const onClick = (event: React.MouseEvent) => {
      openSettings(event.clientX, event.clientY);
    };

    const onKeyPress = (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        const rect = event.currentTarget.getBoundingClientRect();
        openSettings(rect.x, rect.y);
      }
    };

    const rect = moveable.getRect();
    return (
      // eslint-disable-next-line @grafana/no-untranslated-strings
      <div
        key={'settings-viewable'}
        className={'moveable-settings'}
        style={{
          position: 'absolute',
          left: `${rect.width + 18}px`,
          top: '0px',
          color: 'white',
          fontSize: '18px',
          cursor: 'pointer',
          userSelect: 'none',
          willChange: 'transform',
          transform: 'translate(-50%, 0px)',
          zIndex: 100,
        }}
        onClick={onClick}
        onKeyDown={onKeyPress}
        role="button"
        tabIndex={0}
      >
        {``}
        ⚙️
        {``}
      </div>
    );
  },
});

export const dimensionViewable = {
  name: 'dimensionViewable',
  props: [],
  events: [],
  render(moveable: MoveableManagerInterface<unknown, unknown>, React: Renderer) {
    const rect = moveable.getRect();
    return (
      // eslint-disable-next-line @grafana/no-untranslated-strings
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
  props: [],
  events: [],
  render(moveable: MoveableManagerInterface<unknown, unknown>, React: Renderer) {
    const rect = moveable.getRect();
    const targetElement = findElementByTarget(moveable.state.target!, scene.root.elements);

    // If selection is more than 1 element don't display constraint visualizations
    if (scene.selecto?.getSelectedTargets() && scene.selecto?.getSelectedTargets().length > 1) {
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
