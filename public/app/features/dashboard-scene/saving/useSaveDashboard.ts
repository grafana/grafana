import { useAsyncFn } from 'react-use';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
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

        const resultData = result.data;
        scene.saveCompleted(saveModel, resultData, options.folderUid);

        // important that these happen before location redirect below
        appEvents.publish(new DashboardSavedEvent());
        notifyApp.success(t('dashboard-scene.use-save-dashboard.message-dashboard-saved', 'Dashboard saved'));

        //Update local storage dashboard to handle things like last used datasource
        updateDashboardUidLastUsedDatasource(resultData.uid);

        // For analytics tracking, get all expression types used in dashboard
        const expressionTypes = scene.getExpressionTypes(saveModel);

        if (isCopy) {
          reportInteraction('grafana_dashboard_copied', {
            name: saveModel.title,
            url: resultData.url,
            hasExpression: expressionTypes.length > 0,
            expression_types: expressionTypes,
          });
        } else {
          reportInteraction(`grafana_dashboard_${options.isNew ? 'created' : 'saved'}`, {
            name: saveModel.title,
            url: resultData.url,
            hasExpression: expressionTypes.length > 0,
            expression_types: expressionTypes,
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
