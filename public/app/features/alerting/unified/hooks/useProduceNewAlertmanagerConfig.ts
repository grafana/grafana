import { WritableDraft, produce } from 'immer';

import { AlertManagerCortexConfig } from 'app/plugins/datasource/alertmanager/types';

import { alertmanagerApi } from '../api/alertmanagerApi';
import { useAlertmanager } from '../state/AlertmanagerContext';

type IRecipe = (draft: WritableDraft<AlertManagerCortexConfig>) => void;

const ERR_NO_ACTIVE_AM = new Error('no active Alertmanager');

export function useProduceNewAlertmanagerConfiguration() {
  const { selectedAlertmanager } = useAlertmanager();
  const [fetchAlertmanagerConfig, _fetchAlertmanagerState] =
    alertmanagerApi.endpoints.getAlertmanagerConfiguration.useLazyQuery();

  const [updateAlertManager, updateAlertmanagerState] =
    alertmanagerApi.endpoints.updateAlertmanagerConfiguration.useMutation();

  if (!selectedAlertmanager) {
    throw ERR_NO_ACTIVE_AM;
  }

  const produceNewAlertmanagerConfiguration = async (recipe: IRecipe) => {
    const currentAlertmanagerConfiguration = await fetchAlertmanagerConfig(selectedAlertmanager).unwrap();
    const newConfig = produce(currentAlertmanagerConfiguration, recipe);

    return updateAlertManager({
      selectedAlertmanager,
      config: newConfig,
    }).unwrap();
  };

  // @TODO merge loading state with the fetching state
  return [produceNewAlertmanagerConfiguration, updateAlertmanagerState] as const;
}
