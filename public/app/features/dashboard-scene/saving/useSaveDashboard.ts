import { useAsyncFn } from 'react-use';

import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { locationService } from '@grafana/runtime';
import { type Dashboard } from '@grafana/schema';
import { type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { appEvents } from 'app/core/app_events';
import { useAppNotification } from 'app/core/copy/appNotification';
import { useSaveDashboardMutation } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import {
  type SaveDashboardAsOptions,
  type SaveDashboardOptions,
} from 'app/features/dashboard/components/SaveDashboard/types';
import { DashboardSavedEvent } from 'app/types/events';

import { updateDashboardUidLastUsedDatasource } from '../../dashboard/utils/dashboard';
import { finishSavingNewDashboard, withoutPendingChangesPreview } from '../lifecycle/pendingChangePreview';
import { type DashboardScene } from '../scene/DashboardScene';
import { DashboardInteractions } from '../utils/interactions';
import { trackDashboardSceneCreatedOrSaved } from '../utils/tracking';

export function useSaveDashboard(isCopy = false) {
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
        const saveAsSource = options.saveAsCopy ? scene.state : undefined;

        if (options.saveAsCopy) {
          saveModel = scene.getSaveAsModel({
            isNew: options.isNew,
            title: options.title,
            description: options.description,
            copyTags: options.copyTags,
          });
        }

        // A new dashboard proposed as pending changes is created under the uid it was proposed for.
        const newDashboardUid = options.isNew ? scene.state.meta.newDashboardUid : undefined;
        // Attribute the submitted draft, even if the user switches modes while the save is in flight.
        const editSessionTracking = scene.getEditSessionTracking();

        const result = await saveDashboardRtkQuery({
          dashboard: saveModel,
          folderUid: options.folderUid,
          message: options.message,
          overwrite: options.overwrite,
          showErrorAlert: false,
          k8s: newDashboardUid ? { ...options.k8s, name: newDashboardUid } : options.k8s,
          ...(newDashboardUid ? { create: true } : {}),
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

        // Capture before saveCompleted re-snapshots the baseline (which would make this report ~0).
        const diffCount = scene.getDashboardChanges().diffCount;

        await scene.saveCompleted(saveModel, resultData, options.folderUid, saveAsSource);

        if (newDashboardUid) {
          await finishSavingNewDashboard(newDashboardUid);
        }

        if (editSessionTracking.edit_session_id) {
          DashboardInteractions.editPeriodEnded({
            ...editSessionTracking,
            edit_session_id: editSessionTracking.edit_session_id,
            outcome: isCopy ? 'saved_as_copy' : 'saved',
          });
        }

        // important that these happen before location redirect below
        appEvents.publish(new DashboardSavedEvent());
        notifyApp.success(t('dashboard-scene.use-save-dashboard.message-dashboard-saved', 'Dashboard saved'));

        updateDashboardUidLastUsedDatasource(resultData.uid);

        if (isCopy) {
          DashboardInteractions.dashboardCopied({
            name: saveModel.title || '',
            url: resultData.url,
            diff_count: diffCount,
            ...editSessionTracking,
          });
        } else {
          trackDashboardSceneCreatedOrSaved(!!options.isNew, scene, {
            name: saveModel.title || '',
            url: resultData.url || '',
            diff_count: diffCount,
            ...editSessionTracking,
            transformation_counts: scene.getTransformationCounts(saveModel),
            expression_counts: scene.getExpressionCounts(saveModel),
          });
        }

        const currentLocation = locationService.getLocation();
        const newUrl = locationUtil.stripBaseFromUrl(resultData.url);
        // A saved proposal is a regular dashboard now, so the page stops previewing it.
        const search = newDashboardUid ? withoutPendingChangesPreview(currentLocation.search) : currentLocation.search;

        if (newUrl !== currentLocation.pathname || search !== currentLocation.search) {
          setTimeout(() => {
            locationService.push({ pathname: newUrl, search });
          });
        }

        return result.data;
      }
    },
    [notifyApp]
  );

  return { state, onSaveDashboard };
}
