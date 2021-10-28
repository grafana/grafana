import React from 'react';
import {
  CoreApp,
  GrafanaTheme2,
  PanelDataSummary,
  VisualizationSuggestion,
  VisualizationSuggestionsBuilder,
} from '@grafana/data';
import { usePanelContext, useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { VisualizationPreview } from './VizTypePicker/VisualizationPreview';
import { PanelDataErrorViewProps } from '@grafana/runtime';

export function PanelDataErrorView(props: PanelDataErrorViewProps) {
  const { data } = props;
  const styles = useStyles2(getStyles);
  const context = usePanelContext();
  const [suggestions, message] = getSuggestionsAndMessage(props);

  return (
    <div className={styles.wrapper}>
      <div className={styles.message}>{message}</div>
      {context.app === CoreApp.PanelEditor && suggestions && (
        <div className={styles.suggestions}>
          {suggestions.map((suggestion, index) => (
            <VisualizationPreview
              key={index}
              data={data!}
              suggestion={suggestion}
              showTitle={true}
              onChange={() => {}}
              width={200}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getSuggestionsAndMessage(props: PanelDataErrorViewProps): [VisualizationSuggestion[], string] {
  const builder = new VisualizationSuggestionsBuilder(props.data);
  const { dataSummary } = builder;
  const message = getMessageFor(props, dataSummary);

  if (!dataSummary.hasTimeField) {
    const list = builder.getListAppender<any, any>({
      name: 'Switch to table',
      pluginId: 'table',
      options: {},
    });
    list.append({});
  }

  if (dataSummary.hasStringField && dataSummary.hasNumberField) {
    const list = builder.getListAppender<any, any>({
      name: 'Switch to bar chart',
      pluginId: 'barchart',
      options: {},
      fieldConfig: {
        defaults: {},
        overrides: [],
      },
    });

    list.append({});
  }

  return [builder.getList(), message];
}

function getMessageFor(
  { data, message, needsNumberField, needsTimeField }: PanelDataErrorViewProps,
  dataSummary: PanelDataSummary
): string {
  if (message) {
    return message;
  }

  if (!data.series || data.series.length === 0) {
    return 'No data';
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
    suggestionsHeading: css({
      textAlign: 'center',
      marginTop: theme.spacing(2),
      color: theme.colors.text.secondary,
      width: '100%',
    }),
    suggestions: css({
      marginTop: theme.spacing(2),
      display: 'flex',
    }),
  };
};
