import { useAsyncFn } from 'react-use';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';

import appEvents from 'app/core/app_events';
import { useAppNotification } from 'app/core/copy/appNotification';
import { updateDashboardName } from 'app/core/reducers/navBarTree';
import { useSaveDashboardMutation } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { SaveDashboardAsOptions, SaveDashboardOptions } from 'app/features/dashboard/components/SaveDashboard/types';
import { DashboardSavedEvent } from 'app/types/events';
import { useDispatch } from 'app/types/store';

import { updateDashboardUidLastUsedDatasource } from '../../dashboard/utils/dashboard';
import { DashboardScene } from '../scene/DashboardScene';
import { DashboardInteractions } from '../utils/interactions';
import { trackDashboardSceneCreatedOrSaved } from '../utils/tracking';

export function useSaveDashboard(isCopy = false) {
  const dispatch = useDispatch();
  const notifyApp = useAppNotification();
  const [saveDashboardRtkQuery] = useSaveDashboardMutation();

  const [state, onSaveDashboard] = useAsyncFn(
    async (
      scene: DashboardScene,
      options: SaveDashboardOptions &
        SaveDashboardAsOptions & {
          // When provided, will take precedence over the scene's save model
          rawDashboardJSON?: Dashboard | DashboardV2Spec;
        }
    ) => {
      {
        let saveModel = options.rawDashboardJSON ?? scene.getSaveModel();

        if (options.saveAsCopy) {
          saveModel = scene.getSaveAsModel({
            isNew: options.isNew,
            title: options.title,
            description: options.description,
            copyTags: options.copyTags,
          });
        }

        const result = await saveDashboardRtkQuery({
          dashboard: saveModel,
          folderUid: options.folderUid,
          message: options.message,
          overwrite: options.overwrite,
          showErrorAlert: false,
          k8s: options.k8s,
        });

        if ('error' in result) {
          throw result.error;
        }

        // result.data is readonly so spreading to allow for slug edits
        const resultData: typeof result.data = { ...result.data };

        // TODO: use slug from response once implemented
        // reuse existing slug to avoid "Unsaved changes" modal after save
        //   due to slugify logic difference between frontend and backend
        if (!result.data.slug && scene.state.meta.slug) {
          const slug = scene.state.meta.slug;
          resultData.slug = slug;
          resultData.url = `${result.data.url}/${slug}`;
        }

        scene.saveCompleted(saveModel, resultData, options.folderUid);

        // important that these happen before location redirect below
        appEvents.publish(new DashboardSavedEvent());
        notifyApp.success(t('dashboard-scene.use-save-dashboard.message-dashboard-saved', 'Dashboard saved'));

        updateDashboardUidLastUsedDatasource(resultData.uid);

        if (isCopy) {
          DashboardInteractions.dashboardCopied({ name: saveModel.title || '', url: resultData.url });
        } else {
          trackDashboardSceneCreatedOrSaved(!!options.isNew, scene, {
            name: saveModel.title || '',
            url: resultData.url || '',
          });
        }

        const currentLocation = locationService.getLocation();
        const newUrl = locationUtil.stripBaseFromUrl(resultData.url);

        if (newUrl !== currentLocation.pathname) {
          setTimeout(() => {
            locationService.push({ pathname: newUrl, search: currentLocation.search });
          });
        }

        if (scene.state.meta.isStarred) {
          dispatch(
            updateDashboardName({
              id: resultData.uid,
              title: scene.state.title,
              url: newUrl,
            })
          );
        }

        return result.data;
      }
    },
    [dispatch, notifyApp]
  );

  return { state, onSaveDashboard };
}
