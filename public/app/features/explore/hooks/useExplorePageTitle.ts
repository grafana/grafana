import { isTruthy } from '@grafana/data';
import { Branding } from 'app/core/components/Branding/Branding';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { useSelector } from 'app/types';

export function useExplorePageTitle() {
  const navModel = useNavModel('explore');

  const datasourceNames = useSelector((state) =>
    Object.values(state.explore.panes).map((pane) => pane?.datasourceInstance?.name)
  ).filter(isTruthy);

  document.title = `${navModel.main.text} - ${datasourceNames.join(' | ')} - ${Branding.AppTitle}`;
}
