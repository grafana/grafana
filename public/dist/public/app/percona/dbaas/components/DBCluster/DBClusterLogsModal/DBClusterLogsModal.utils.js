export const transformLogs = ({ logs }, currentLogs) => {
    const logsMap = logs.reduce((acc, { pod, container, logs }) => {
        if (!acc[pod]) {
            acc[pod] = { name: pod, isOpen: false, events: '', containers: [] };
        }
        // if pod has container, logs are for that container
        // otherwise they are pod events
        if (container) {
            acc[pod].containers = [
                ...acc[pod].containers,
                {
                    name: container,
                    isOpen: false,
                    logs: logsToString(logs),
                },
            ];
        }
        else {
            acc[pod].events = logsToString(logs);
        }
        return acc;
    }, {});
    return { pods: Object.values(logsMap) };
};
export const logsToString = (logs) => (logs ? logs.join('\n') : '');
export const toggleLogs = (pods, expand) => {
    return pods.reduce((accPods, pod) => {
        const containers = pod.containers.reduce((accContainers, container) => [...accContainers, Object.assign(Object.assign({}, container), { isOpen: expand })], []);
        return [...accPods, Object.assign(Object.assign({}, pod), { isOpen: expand, containers })];
    }, []);
};
//# sourceMappingURL=DBClusterLogsModal.utils.js.map