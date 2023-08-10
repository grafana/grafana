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
  Field,
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
  const { panelId, data } = props;
  const styles = useStyles2(getStyles);
  const context = usePanelContext();
  const builder = new VisualizationSuggestionsBuilder(data);
  // When is the best time to check the data for transformation suggestions?
  // Do we build our own data summary here relevant to our needs?
  const { dataSummary } = builder;
  const message = getMessageFor(props, dataSummary);
  const dispatch = useDispatch();

  const panel = getDashboardSrv().getCurrent()?.getPanelById(panelId);

  const { error, value } = useAsync(async () => {
    const skynetEnabled = await llms.openai.enabled();
    console.log(skynetEnabled, 'openai API enabled');

    if (!skynetEnabled) {
      return { skynetEnabled: false, skynetSuggestion: null };
    }

    try {
      const skynetSuggestion = await getSkynetSuggestion(skynetEnabled);
      console.log(skynetSuggestion, 'skynet suggestion');

      return { skynetEnabled, skynetSuggestion };
    } catch (error) {
      console.error('Error in useAsync:', error);
      // Re-throw the error to be handled by the component
      throw error;
    }
  }, []);

  console.log(value, "use 'value.skynetEnabled' to check if skynet is enabled component-wide");

  const getSkynetSuggestion = async (skynetEnabled: boolean | undefined) => {
    try {
      console.log('getSkynetSuggestions try');
      const skynetSuggestion = await askSkynet(skynetEnabled);
      console.log(skynetSuggestion, 'skynet suggestion');
      return skynetSuggestion;
    } catch (error) {
      console.error('Error:', error);
      throw error;
    }
  };

  const askSkynet = (
    skynetEnabled: boolean | undefined,
    // Default values here for testing purposes
    sampleValues: Array<string | number> = [1, 2, 3],
    formats: string[] = ['datetime', 'number', 'timestamp', 'string']
  ) => {
    console.log(skynetEnabled, 'skynet enabled???????????');
    // No need to run the call if openai is not enabled
    if (!skynetEnabled) {
      return null;
    }

    // Join the values for the prompt
    const joinedValues = sampleValues.join('", "');
    const joinedFormats = formats.join('", "');
    const prompt =
      `using this list of possible answers (${joinedFormats}), review the following string or number, ` +
      `and return to me only the single item from the list mentioned above that most probably represents ` +
      `all items in the following list: ${joinedValues}. reminder: please answer with one word.`;

    const stream = llms.openai
      .streamChatCompletions({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'system', content: prompt }],
      })
      .pipe(llms.openai.accumulateContent());

    // Final value to be returned, and updated by the stream
    let final = '';

    return new Promise((resolve, reject) => {
      const subscription = stream.subscribe({
        next: (skynetResponse) => {
          console.log(skynetResponse, 'skynet response');
          // Update the final value, only if the response is truthy
          if (skynetResponse) {
            final = skynetResponse;
          }
        },
        complete: () => {
          // Log the status
          console.log('Stream completed');
          console.log(final, 'final');
          // Resolve the promise with the final value
          resolve(final);
        },
        error: (error) => {
          // Log the error
          console.error('Error occurred:', error);
          // Reject the promise with the error for later handling
          reject(error);
        },
      });

      // Clean up the subscription when the promise is resolved or rejected
      subscription.unsubscribe();
    });
  };

  if (error) {
    console.error(error.message);
    // JEV: do something more useful here
    return null;
  }

  const stringIsValidMomentDatetime = (field: Field): boolean =>
    field.values.slice(0, 5).every((v) => moment(v).isValid());

  const numberIsValidUnixEpoch = (field: Field): boolean =>
    field.values.slice(0, 5).every((v) => {
      console.log(v, 'value being checked');
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
    });

  // Where are these suggestions coming from? Are
  let suggestions = props.suggestions || [];
  // What if the dataSummary is not reliable for recognizing fields correctly?
  if (props.needsTimeField && !dataSummary.hasTimeField && panel && panel.plugin?.hasPluginId) {
    const transformations = panel.transformations ? [...panel.transformations] : [];
    // Only push the transformation is the user wants to add it?
    const f = props.data.series[0].fields.find((f) => {
      return (
        (f.type === FieldType.string && stringIsValidMomentDatetime(f)) ||
        (f.type === FieldType.number && numberIsValidUnixEpoch(f))
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
