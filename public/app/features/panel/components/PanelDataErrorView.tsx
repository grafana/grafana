import { css } from '@emotion/css';
import moment from 'moment';
import React from 'react';
import { useAsync } from 'react-use';

import {
  CoreApp,
  GrafanaTheme2,
  PanelDataSummary,
  VisualizationSuggestionsBuilder,
  VisualizationSuggestion,
  DataTransformerID,
  FieldType,
} from '@grafana/data';
import { llms } from '@grafana/experimental';
import { PanelDataErrorViewProps, locationService } from '@grafana/runtime';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { CardButton } from 'app/core/components/CardButton';
import { LS_VISUALIZATION_SELECT_TAB_KEY } from 'app/core/constants';
import store from 'app/core/store';
import { toggleVizPicker } from 'app/features/dashboard/components/PanelEditor/state/reducers';
import { VisualizationSelectPaneTab } from 'app/features/dashboard/components/PanelEditor/types';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { useDispatch } from 'app/types';

import { changePanelPlugin } from '../state/actions';

export function PanelDataErrorView(props: PanelDataErrorViewProps) {
  const styles = useStyles2(getStyles);
  const context = usePanelContext();
  const builder = new VisualizationSuggestionsBuilder(props.data);
  // When is the best time to check the data for transformation suggestions?
  // Do we build our own data summary here relevant to our needs?
  const { dataSummary } = builder;
  const message = getMessageFor(props, dataSummary);
  const dispatch = useDispatch();

  const panel = getDashboardSrv().getCurrent()?.getPanelById(props.panelId);
  /*
  const { loading, error, value } = useAsync(async () => {
    const enabled = await llms.openai.enabled();
    if (!enabled) {
      return false;
    }

    // We don't really need to steam the completions, since there will really only be a single string answer,
    // but this is how the LLM functionality is currently implemented.
    const stream = llms.openai.streamChatCompletions({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: 'default promt that we build to check for time types/fields' }],
      })
      .pipe(
        // Accumulate the stream chunks into a single string.
        llms.openai.accumulateContent()
      );
    // Subscribe to the stream and update the state for each returned value.
    return {
      enabled,
      // Do we need to subscribe to the stream here? None of this is being streamed to the UI.
      // Instead here do have a side-effect of updating the transformation suggestions?
      // TODO: DO SOMETHING WITH THE STREAM
      // stream: stream.subscribe(setReply),
    };
    // This message should never change outside of mount.
  }, [message]);

  if (error) {
    console.error(error.message);
    // TODO: DO SOMETHING MORE WITH THIS ERROR
    return null;
  }

  // If we add the LLM logic here, we'll need to consider how to handle the async nature of the API.
  // Do we want to run the LLM logic by default? Or give the user the option to run it?

  // The LLM functionality in experimental is streaming by nature, even if we are only wanting to returm a stream of one item.
*/
  // Where are these suggestions coming from? Are
  let suggestions = props.suggestions || [];
  // What if the dataSummary is not reliable for recognizing fields correctly?
  if (props.needsTimeField && !dataSummary.hasTimeField && panel && panel.plugin?.hasPluginId) {
    const transformations = panel.transformations ? [...panel.transformations] : [];
    // Only push the transformation is the user wants to add it?
    const f = props.data.series[0].fields.find((f) => {
      return (
        (f.type === FieldType.string && f.values.slice(0, 5).every((v) => moment(v).isValid())) ||
        (f.type === FieldType.number &&
          f.values.slice(0, 5).every((v) => {
            const epoch = moment.unix(v);
            //Let's assume numbers that parse to +-5 years from now are unix epochs
            let yearDiff = epoch.diff(moment(), 'years');
            if (yearDiff < 5 && yearDiff > -5) {
              return true;
            }
            const epochMillies = moment.unix(v / 1000);
            yearDiff = epochMillies.diff(moment(), 'years');
            if (yearDiff < 5 && yearDiff > -5) {
              return true;
            }
            return false;
          }))
      );
    });
    transformations.push({
      id: DataTransformerID.convertFieldType,
      options: {
        // Is this where we let the LLM choose the format? Or do we bake in a default?
        // Or let the user choose the format? What should the UI/UX for the user choosing it look like?
        fields: {},
        conversions: [{ targetField: f?.name, destinationType: FieldType.time, dateFormat: undefined }],
      },
    });

    // Are `suggestions` panel suggestions or transformation suggestions?
    suggestions.push({
      name: `Convert the field \'${f?.name}\' to a time field.`,
      pluginId: panel.plugin?.meta.id,
      transformations,
    });
  }

  const openVizPicker = () => {
    store.setObject(LS_VISUALIZATION_SELECT_TAB_KEY, VisualizationSelectPaneTab.Suggestions);
    dispatch(toggleVizPicker(true));
  };

  const switchToTable = () => {
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

  const loadSuggestion = (s: VisualizationSuggestion) => {
    if (!panel) {
      return;
    }
    dispatch(
      changePanelPlugin({
        ...s, // includes panelId, config, etc
        panel,
      })
    );
    if (s.transformations) {
      setTimeout(() => {
        locationService.partial({ tab: 'transform' });
      }, 100);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.message}>{message}</div>
      {context.app === CoreApp.PanelEditor && dataSummary.hasData && panel && (
        <div className={styles.actions}>
          {suggestions && (
            <>
              {suggestions.map((v) => (
                <CardButton key={v.name} icon="process" onClick={() => loadSuggestion(v)}>
                  {v.name}
                </CardButton>
              ))}
            </>
          )}
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
  { data, fieldConfig, message, needsNumberField, needsTimeField, needsStringField }: PanelDataErrorViewProps,
  dataSummary: PanelDataSummary
): string {
  if (message) {
    return message;
  }

  if (!data.series || data.series.length === 0 || data.series.every((frame) => frame.length === 0)) {
    return fieldConfig?.defaults.noValue ?? 'No data';
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
