import { useAsyncFn } from 'react-use';

import { locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { useAppNotification } from 'app/core/copy/appNotification';
import { updateDashboardName } from 'app/core/reducers/navBarTree';
import { useSaveDashboardMutation } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { SaveDashboardOptions } from 'app/features/dashboard/components/SaveDashboard/types';
import { useDispatch } from 'app/types';
import { DashboardSavedEvent } from 'app/types/events';

import { updateDashboardUidLastUsedDatasource } from '../../dashboard/utils/dashboard';
import { DashboardScene } from '../scene/DashboardScene';

const saveDashboard = async (
  saveModel: any,
  options: SaveDashboardOptions,
  saveDashboardRtkQuery: ReturnType<typeof useSaveDashboardMutation>[0]
) => {
  const query = await saveDashboardRtkQuery({
    dashboard: saveModel,
    folderUid: options.folderUid,
    message: options.message,
    overwrite: options.overwrite,
  });

  if ('error' in query) {
    throw query.error;
  }

  return query.data;
};

export function useDashboardSave(isCopy = false) {
  const dispatch = useDispatch();
  const notifyApp = useAppNotification();
  const [saveDashboardRtkQuery] = useSaveDashboardMutation();

  const [state, onSaveDashboard] = useAsyncFn(
    async (scene: DashboardScene, saveModel: Dashboard, options: SaveDashboardOptions) => {
      {
        const result = await saveDashboard(saveModel, options, saveDashboardRtkQuery);

        scene.setState({
          version: result.version,
          meta: {
            ...scene.state.meta,
            uid: result.uid,
            url: result.url,
            slug: result.slug,
            folderUid: options.folderUid,
          },
        });

        scene.onSaveCompleted();

        // important that these happen before location redirect below
        appEvents.publish(new DashboardSavedEvent());
        notifyApp.success('Dashboard saved');

        //Update local storage dashboard to handle things like last used datasource
        updateDashboardUidLastUsedDatasource(result.uid);

        if (isCopy) {
          reportInteraction('grafana_dashboard_copied', {
            name: saveModel.title,
            url: result.url,
          });
        } else {
          reportInteraction(`grafana_dashboard_${result.uid ? 'saved' : 'created'}`, {
            name: saveModel.title,
            url: result.url,
          });
        }

        const currentPath = locationService.getLocation().pathname;
        const newUrl = locationUtil.stripBaseFromUrl(result.url);

        if (newUrl !== currentPath) {
          setTimeout(() => locationService.replace(newUrl));
        }
        if (scene.state.meta.isStarred) {
          dispatch(
            updateDashboardName({
              id: result.uid,
              title: scene.state.title,
              url: newUrl,
            })
          );
        }
        return result;
      }
    },
    [dispatch, notifyApp]
  );

  return { state, onSaveDashboard };
}
