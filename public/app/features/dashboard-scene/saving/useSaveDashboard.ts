import { useAsyncFn } from 'react-use';

import { locationUtil } from '@grafana/data';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { useAppNotification } from 'app/core/copy/appNotification';
import { updateDashboardName } from 'app/core/reducers/navBarTree';
import { useSaveDashboardMutation } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { SaveDashboardAsOptions, SaveDashboardOptions } from 'app/features/dashboard/components/SaveDashboard/types';
import { useDispatch } from 'app/types';
import { DashboardSavedEvent } from 'app/types/events';

import { updateDashboardUidLastUsedDatasource } from '../../dashboard/utils/dashboard';
import { DashboardScene } from '../scene/DashboardScene';

function applyChrononVariablesToTargets(saveModel: any) {
  if (!Array.isArray(saveModel?.panels) || !Array.isArray(saveModel?.templating?.list)) {
    return saveModel;
  }

  const variableNames = saveModel.templating.list.map((variable: any) => variable.name);
  const variablesAsProps = Object.fromEntries(
    variableNames.map((variableName: any) => [variableName, `$${variableName}`])
  );

  const updatedPanels = saveModel.panels.map((panel: any) => {
    if (panel?.datasource?.type === 'chronon-datasource' && Array.isArray(panel.targets)) {
      const updatedTargets = panel.targets.map((target: any) => ({ ...target, ...variablesAsProps }));
      return { ...panel, targets: updatedTargets };
    }

    return panel;
  });

  return { ...saveModel, panels: updatedPanels };
}

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
          rawDashboardJSON?: Dashboard;
        }
    ) => {
      {
        let saveModel = options.rawDashboardJSON ?? scene.getSaveModel();
        saveModel = applyChrononVariablesToTargets(saveModel);

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
          k8s: undefined, // TODO?  pass the original metadata
        });

        if ('error' in result) {
          throw result.error;
        }

        const resultData = result.data;
        scene.saveCompleted(saveModel, resultData, options.folderUid);

        // important that these happen before location redirect below
        appEvents.publish(new DashboardSavedEvent());
        notifyApp.success('Dashboard saved');

        //Update local storage dashboard to handle things like last used datasource
        updateDashboardUidLastUsedDatasource(resultData.uid);

        if (isCopy) {
          reportInteraction('grafana_dashboard_copied', {
            name: saveModel.title,
            url: resultData.url,
          });
        } else {
          reportInteraction(`grafana_dashboard_${resultData.uid ? 'saved' : 'created'}`, {
            name: saveModel.title,
            url: resultData.url,
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

        const params = new URLSearchParams(window.location.search);
        const assetId = params.get('assetId');

        window.parent.postMessage(
          {
            source: 'grafana-dashboard-integration-event',
            payload: {
              uid: resultData.uid,
              assetId,
            },
          },
          '*'
        );

        return result.data;
      }
    },
    [dispatch, notifyApp]
  );

  return { state, onSaveDashboard };
}
