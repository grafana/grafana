import { css } from '@emotion/css';

import {
  CoreApp,
  GrafanaTheme2,
  PanelDataSummary,
  VisualizationSuggestionsBuilder,
  VisualizationSuggestion,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t, Trans } from '@grafana/i18n';
import { PanelDataErrorViewProps, locationService } from '@grafana/runtime';
import { VizPanel } from '@grafana/scenes';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { CardButton } from 'app/core/components/CardButton';
import { LS_VISUALIZATION_SELECT_TAB_KEY } from 'app/core/constants';
import store from 'app/core/store';
import { toggleVizPicker } from 'app/features/dashboard/components/PanelEditor/state/reducers';
import { VisualizationSelectPaneTab } from 'app/features/dashboard/components/PanelEditor/types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { findVizPanelByKey, getVizPanelKeyForPanelId } from 'app/features/dashboard-scene/utils/utils';
import { useDispatch } from 'app/types/store';

import { changePanelPlugin } from '../state/actions';

export function PanelDataErrorView(props: PanelDataErrorViewProps) {
  const styles = useStyles2(getStyles);
  const context = usePanelContext();
  const builder = new VisualizationSuggestionsBuilder(props.data);
  const { dataSummary } = builder;
  const message = getMessageFor(props, dataSummary);
  const dispatch = useDispatch();

  const dashboardScene: DashboardScene | undefined = window.__grafanaSceneContext;
  let panel;
  if (dashboardScene instanceof DashboardScene) {
    panel = findVizPanelByKey(dashboardScene, getVizPanelKeyForPanelId(props.panelId));
  } else {
    panel = getDashboardSrv().getCurrent()?.getPanelById(props.panelId);
  }

  const openVizPicker = () => {
    store.setObject(LS_VISUALIZATION_SELECT_TAB_KEY, VisualizationSelectPaneTab.Suggestions);
    if (dashboardScene) {
      dashboardScene.state.editPanel?.state.optionsPane?.onToggleVizPicker();

      return;
    }

    dispatch(toggleVizPicker(true));
  };

  const switchToTable = () => {
    if (!panel) {
      return;
    }

    if (panel instanceof VizPanel) {
      panel.changePluginType('table');

      return;
    }

    dispatch(
      changePanelPlugin({
        panel,
        pluginId: 'table',
      })
    );
  };

  const loadSuggestion = (s: VisualizationSuggestion) => {
    if (!panel) {
      return;
    }

    if (panel instanceof VizPanel) {
      panel.changePluginType(s.pluginId, s.options, s.fieldConfig);
    } else {
      dispatch(
        changePanelPlugin({
          ...s, // includes panelId, config, etc
          panel,
        })
      );
    }

    if (s.transformations) {
      setTimeout(() => {
        locationService.partial({ tab: 'transform' });
      }, 100);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.message} data-testid={selectors.components.Panels.Panel.PanelDataErrorMessage}>
        {message}
      </div>
      {context.app === CoreApp.PanelEditor && dataSummary.hasData && panel && (
        <div className={styles.actions}>
          {props.suggestions && (
            <>
              {props.suggestions.map((v) => (
                <CardButton key={v.name} icon="process" onClick={() => loadSuggestion(v)}>
                  {v.name}
                </CardButton>
              ))}
            </>
          )}
          <CardButton icon="table" onClick={switchToTable}>
            <Trans i18nKey="panel.panel-data-error-view.switch-to-table">Switch to table</Trans>
          </CardButton>
          <CardButton icon="chart-line" onClick={openVizPicker}>
            <Trans i18nKey="panel.panel-data-error-view.open-visualization-suggestions">
              Open visualization suggestions
            </Trans>
          </CardButton>
        </div>
      )}
    </div>
  );
}

function getMessageFor(
  { data, fieldConfig, message, needsNumberField, needsTimeField, needsStringField }: PanelDataErrorViewProps,
  dataSummary: PanelDataSummary
): string {
  if (message) {
    return message;
  }

  if (!data.series || data.series.length === 0 || data.series.every((frame) => frame.length === 0)) {
    return fieldConfig?.defaults.noValue ?? t('panel.panel-data-error-view.no-value.default', 'No data');
  }

  if (needsStringField && !dataSummary.hasStringField) {
    return t('panel.panel-data-error-view.missing-value.string', 'Data is missing a string field');
  }

  if (needsNumberField && !dataSummary.hasNumberField) {
    return t('panel.panel-data-error-view.missing-value.number', 'Data is missing a number field');
  }

  if (needsTimeField && !dataSummary.hasTimeField) {
    return t('panel.panel-data-error-view.missing-value.time', 'Data is missing a time field');
  }

  return t('panel.panel-data-error-view.missing-value.unknown', 'Cannot visualize data');
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
      width: '100%',
    }),
    message: css({
      textAlign: 'center',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.size.lg,
      width: '100%',
    }),
    actions: css({
      marginTop: theme.spacing(2),
      display: 'flex',
      height: '50%',
      maxHeight: '150px',
      columnGap: theme.spacing(1),
      rowGap: theme.spacing(1),
      width: '100%',
      maxWidth: '600px',
    }),
  };
};
