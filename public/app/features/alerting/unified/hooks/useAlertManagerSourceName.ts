import { useSelectedAlertmanager } from '../state/AlertmanagerContext';

/* This will return am name either from query params or from local storage or a default (grafana).
 * Due to RBAC permissions Grafana Managed Alert manager or external alert managers may not be available
 * In the worst case neither GMA nor external alert manager is available
 */
// TODO remove this fn and use useSelectedAlertmanager(); everywhere
interface Props {
  withPermissions: 'instance' | 'notification';
}

export function useAlertManagerSourceName(
  props?: Props
): [string | undefined, (alertManagerSourceName: string) => void] {
  const { selectedAlertmanager, setSelectedAlertmanager } = useSelectedAlertmanager(props);
  return [selectedAlertmanager, setSelectedAlertmanager];
}
