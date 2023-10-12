import { css } from '@emotion/css';
import React, { useEffect } from 'react';

import { DataFrame, GrafanaTheme2, LogsSortOrder, SplitOpen, TimeRange } from '@grafana/data/src';
import { Themeable2 } from '@grafana/ui/src';

import { LogsTable } from './LogsTable';

interface LogsTableProps {
  logsFrames?: DataFrame[];
  width: number;
  timeZone: string;
  splitOpen: SplitOpen;
  range: TimeRange;
  logsSortOrder: LogsSortOrder;
}

interface Props extends Themeable2 {
  logsTableProps: LogsTableProps;
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
    }),
    sidebar: css({
      fontSize: theme.typography.pxToRem(10),
    }),
  };
}

export const LogsTableWrap: React.FunctionComponent<Props> = (props) => {
  const styles = getStyles(props.theme);
  const { logsFrames } = props.logsTableProps;
  // Save the normalized cardinality of each label
  const [labelCardinalityState, setLabelCardinality] = React.useState<Record<string, number>>({});

  // look into dedupLogRows
  const labelsField = logsFrames?.length ? logsFrames[0].fields.find((field) => field.name === 'labels') : undefined;
  const numberOfLogLines = logsFrames ? logsFrames[0].length : 0;

  useEffect(() => {
    if (labelsField?.values.length && numberOfLogLines) {
      const labelCardinality = new Map<string, number>();

      labelsField?.values.forEach((labels: Array<Record<string, string>>) => {
        const keys = Object.keys(labels);
        keys.forEach((key) => {
          if (labelCardinality.has(key)) {
            labelCardinality.set(key, labelCardinality.get(key)! + 1);
          } else {
            labelCardinality.set(key, 1);
          }
        });
      });

      const normalizeLabelCardinality = Object.fromEntries(labelCardinality);
      Object.keys(normalizeLabelCardinality).forEach((key) => {
        normalizeLabelCardinality[key] = Math.round((100 * normalizeLabelCardinality[key]) / numberOfLogLines);
      });

      setLabelCardinality(normalizeLabelCardinality);
    }
  }, [labelsField, numberOfLogLines]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.sidebar}>Hello sidebar</div>
      <LogsTable
        logsSortOrder={props.logsTableProps.logsSortOrder}
        range={props.logsTableProps.range}
        splitOpen={props.logsTableProps.splitOpen}
        timeZone={props.logsTableProps.timeZone}
        width={props.logsTableProps.width}
        logsFrames={logsFrames}
        labelCardinalityState={labelCardinalityState}
        sparsityThreshold={80}
      />
    </div>
  );
};
