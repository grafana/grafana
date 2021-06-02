import { DBClusterLogs, DBClusterLogsAPI, DBClusterPodLogs } from '../DBCluster.types';
import { DBClusterLogsMap } from './DBClusterLogsModal.types';

export const transformLogs = ({ logs }: DBClusterLogsAPI, currentLogs?: DBClusterLogs): DBClusterLogs => {
  const logsMap: DBClusterLogsMap = logs.reduce((acc, { pod, container, logs }) => {
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
    } else {
      acc[pod].events = logsToString(logs);
    }

    return acc;
  }, {} as DBClusterLogsMap);

  return { pods: Object.values(logsMap) };
};

export const logsToString = (logs?: string[]) => (logs ? logs.join('\n') : '');

export const toggleLogs = (pods: DBClusterPodLogs[], expand: boolean) => {
  return pods.reduce((accPods, pod) => {
    const containers = pod.containers.reduce(
      (accContainers, container) => [...accContainers, { ...container, isOpen: expand }],
      []
    );

    return [...accPods, { ...pod, isOpen: expand, containers }];
  }, []);
};
