import { HorizontalConstraint, VerticalConstraint } from '../types';
export const settingsViewable = (scene) => ({
    name: 'settingsViewable',
    props: {},
    events: {},
    render(moveable, React) {
        var _a, _b;
        // If selection is more than 1 element don't display settings button
        if (((_a = scene.selecto) === null || _a === void 0 ? void 0 : _a.getSelectedTargets()) && ((_b = scene.selecto) === null || _b === void 0 ? void 0 : _b.getSelectedTargets().length) > 1) {
            return;
        }
        const openSettings = (x, y) => {
            const container = moveable.getContainer();
            const evt = new PointerEvent('contextmenu', { clientX: x, clientY: y });
            container.dispatchEvent(evt);
        };
        const onClick = (event) => {
            openSettings(event.clientX, event.clientY);
        };
        const onKeyPress = (event) => {
            if (event.key === 'Enter') {
                const rect = event.currentTarget.getBoundingClientRect();
                openSettings(rect.x, rect.y);
            }
        };
        const rect = moveable.getRect();
        return (React.createElement("div", { key: 'settings-viewable', className: 'moveable-settings', style: {
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
            }, onClick: onClick, onKeyDown: onKeyPress, role: "button", tabIndex: 0 },
            ``,
            "\u2699\uFE0F",
            ``));
    },
});
export const dimensionViewable = {
    name: 'dimensionViewable',
    props: {},
    events: {},
    render(moveable, React) {
        const rect = moveable.getRect();
        return (React.createElement("div", { key: 'dimension-viewable', className: 'moveable-dimension', style: {
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
            } },
            Math.round(rect.offsetWidth),
            " x ",
            Math.round(rect.offsetHeight)));
    },
};
export const constraintViewable = (scene) => ({
    name: 'constraintViewable',
    props: {},
    events: {},
    render(moveable, React) {
        var _a, _b, _c, _d;
        const rect = moveable.getRect();
        const targetElement = scene.findElementByTarget(moveable.state.target);
        // If selection is more than 1 element don't display constraint visualizations
        if (((_a = scene.selecto) === null || _a === void 0 ? void 0 : _a.getSelectedTargets()) && ((_b = scene.selecto) === null || _b === void 0 ? void 0 : _b.getSelectedTargets().length) > 1) {
            return;
        }
        let verticalConstraintVisualization = null;
        let horizontalConstraintVisualization = null;
        const constraint = (_d = (_c = targetElement === null || targetElement === void 0 ? void 0 : targetElement.tempConstraint) !== null && _c !== void 0 ? _c : targetElement === null || targetElement === void 0 ? void 0 : targetElement.options.constraint) !== null && _d !== void 0 ? _d : {};
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
//# sourceMappingURL=ables.js.map