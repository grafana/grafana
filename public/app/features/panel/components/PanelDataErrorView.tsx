import React from 'react';
import { CoreApp, GrafanaTheme2, PanelDataSummary, VisualizationSuggestionsBuilder } from '@grafana/data';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { PanelDataErrorViewProps } from '@grafana/runtime';
import { CardButton } from 'app/core/components/CardButton';
import { useDispatch } from 'react-redux';
import { toggleVizPicker } from 'app/features/dashboard/components/PanelEditor/state/reducers';
import { changePanelPlugin } from '../state/actions';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import store from 'app/core/store';
import { LS_VISUALIZATION_SELECT_TAB_KEY } from 'app/core/constants';
import { VisualizationSelectPaneTab } from 'app/features/dashboard/components/PanelEditor/types';

export function PanelDataErrorView(props: PanelDataErrorViewProps) {
  const styles = useStyles2(getStyles);
  const context = usePanelContext();
  const builder = new VisualizationSuggestionsBuilder(props.data);
  const { dataSummary } = builder;
  const message = getMessageFor(props, dataSummary);
  const dispatch = useDispatch();

  const openVizPicker = () => {
    store.setObject(LS_VISUALIZATION_SELECT_TAB_KEY, VisualizationSelectPaneTab.Suggestions);
    dispatch(toggleVizPicker(true));
  };

  const switchToTable = () => {
    const panel = getDashboardSrv().getCurrent()?.getPanelById(props.panelId);
    if (!panel) {
      return;
    }

    dispatch(
      changePanelPlugin({
        panel,
        pluginId: 'table',
      })
    );
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.message}>{message}</div>
      {context.app === CoreApp.PanelEditor && dataSummary.hasData && (
        <div className={styles.actions}>
          <CardButton icon="table" onClick={switchToTable}>
            Switch to table
          </CardButton>
          <CardButton icon="chart-line" onClick={openVizPicker}>
            Open visualization suggestions
          </CardButton>
        </div>
      )}
    </div>
  );
}

function getMessageFor(
  { data, message, needsNumberField, needsTimeField, needsStringField }: PanelDataErrorViewProps,
  dataSummary: PanelDataSummary
): string {
  if (message) {
    return message;
  }

  // In some cases there is a data frame but with no fields
  if (!data.series || data.series.length === 0 || (data.series.length === 1 && data.series[0].fields.length === 0)) {
    return 'No data';
  }

  if (needsStringField && !dataSummary.hasStringField) {
    return 'Data is missing a string field';
  }

  if (needsNumberField && !dataSummary.hasNumberField) {
    return 'Data is missing a number field';
  }

  if (needsTimeField && !dataSummary.hasTimeField) {
    return 'Data is missing a time field';
  }

  return 'Cannot visualize data';
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
