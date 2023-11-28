import { setDashboardLoaderSrv } from 'app/features/dashboard/services/DashboardLoaderSrv';
export function setupLoadDashboardMock(rsp) {
    const loadDashboardMock = jest.fn().mockResolvedValue(rsp);
    setDashboardLoaderSrv({
        loadDashboard: loadDashboardMock,
        // disabling type checks since this is a test util
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    });
    return loadDashboardMock;
}
export function mockResizeObserver() {
    window.ResizeObserver = class ResizeObserver {
        constructor(callback) {
            setTimeout(() => {
                callback([
                    {
                        contentRect: {
                            x: 1,
                            y: 2,
                            width: 500,
                            height: 500,
                            top: 100,
                            bottom: 0,
                            left: 100,
                            right: 0,
                        },
                        // disabling type checks since this is a test util
                        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
                    },
                ], this);
            });
        }
        observe() { }
        disconnect() { }
        unobserve() { }
    };
}
/**
 * Useful from tests to simulate mounting a full scene. Children are activated before parents to simulate the real order
 * of React mount order and useEffect ordering.
 *
 */
export function activateFullSceneTree(scene) {
    const deactivationHandlers = [];
    scene.forEachChild((child) => {
        // For query runners which by default use the container width for maxDataPoints calculation we are setting a width.
        // In real life this is done by the React component when VizPanel is rendered.
        if ('setContainerWidth' in child) {
            // @ts-expect-error
            child.setContainerWidth(500);
        }
        deactivationHandlers.push(activateFullSceneTree(child));
    });
    deactivationHandlers.push(scene.activate());
    return () => {
        for (const handler of deactivationHandlers) {
            handler();
        }
    };
}
//# sourceMappingURL=test-utils.js.map