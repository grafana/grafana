import { css } from '@emotion/css';
import React from 'react';
import { connect, ConnectedProps } from 'react-redux';
import AutoSizer from 'react-virtualized-auto-sizer';

import { DataFrame, GrafanaTheme2, SplitOpen } from '@grafana/data';
import { Table, useStyles2 } from '@grafana/ui';
import { traceSpanSetFrame, traceSpanSetAttrs } from 'app/plugins/datasource/tempo/resultTransformer';
import { StoreState, ExploreItemState, ExploreId } from 'app/types';

import { runQueries } from '../../state/query';

interface DispatchProps {
  dataFrames: DataFrame[];
  exploreId: ExploreId;
  splitOpenFn: SplitOpen;
}

type Props = DispatchProps & ConnectedProps<typeof connector>;

export function TraceResults(props: Props) {
  const { dataFrames, splitOpenFn, range } = props;
  const styles = useStyles2(getStyles);
  const fields = dataFrames[0].fields;

  if (fields.filter((x) => x.name === 'traceID').length > 0) {
    const traceID = fields.filter((x) => x.name === 'traceID')[0].values;
    const startTimes = fields.filter((x) => x.name === 'startTime')[0].values;
    const durations = fields.filter((x) => x.name === 'traceDuration')[0].values;
    const names = fields.filter((x) => x.name === 'traceName')[0].values;
    const spanSets = fields.filter((x) => x.name === 'spanSets')[0].values;
    const instanceSettings = fields.filter((x) => x.name === 'instanceSettings')[0].values;

    return (
      <span className={styles.container}>
        {names.map((_, i) => {
          const spanSetFrames = traceSpanSetFrame(traceID[i], spanSets[i], instanceSettings[i], splitOpenFn, range);
          const spanSetAttrs = traceSpanSetAttrs(spanSets[i]);

          return (
            <div key={i}>
              <div className={styles.trace}>
                <div className={styles.header}>
                  <span className={styles.name}>{names[i]}</span>
                  <span className={styles.duration}>{durations[i]}ms</span>
                  <span className={styles.startTime}>{startTimes[i]}</span>
                </div>
                <div className={styles.spanSets}>
                  {spanSetFrames.map((spanSetFrame, i2) => {
                    const tableHeight = spanSetFrame.length * 38 + 30 + 'px';

                    return (
                      <div className={styles.span} key={i2}>
                        <div className={styles.spanHeader}>
                          <span className={styles.matched}>Match {i2 + 1}</span>
                          <span className={styles.attrs}>
                            {spanSetAttrs[i2].map((spanSetAttr, i3) => {
                              return (
                                <span className={styles.attr} key={i3}>
                                  {spanSetAttr}
                                </span>
                              );
                            })}
                          </span>
                        </div>
                        <div className={styles.set}>
                          <AutoSizer style={{ width: '100%', height: tableHeight }}>
                            {({ width, height }) => {
                              return <Table data={spanSetFrame} width={width} height={height} />;
                            }}
                          </AutoSizer>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </span>
    );
  }
  return <span>No data</span>;
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  const item: ExploreItemState = explore.panes[exploreId]!;
  const { range } = item;

  return {
    range,
  };
}
const mapDispatchToProps = {
  runQueries,
};

const connector = connect(mapStateToProps, mapDispatchToProps);
export default connector(TraceResults);

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      label: container;
    `,
    trace: css`
      label: trace;
      background: ${theme.colors.emphasize(theme.colors.background.primary, 0.03)};
      display: flex;
      flex-direction: row;
      flex-flow: column;
      border: 1px solid ${theme.colors.border.weak};
      padding: 5px;
      margin: 10px 0;
    `,
    header: css`
      label: header;
      display: flex;
      padding: 5px;
    `,
    name: css`
      label: name;
      flex: 1;
    `,
    duration: css`
      label: duration;
      padding-right: 30px;
    `,
    startTime: css`
      label: startTime;
    `,
    spanSets: css`
      label: spanSets;
    `,
    span: css`
      label: span;
      margin: 10px;
    `,
    spanHeader: css`
      label: spanHeader;
      display: flex;
    `,
    matched: css`
      label: matched;
      flex: 1;
    `,
    attrs: css`
      label: attrs;
    `,
    attr: css`
      label: attr;
      margin-left: 20px;
    `,
    set: css`
      label: set;
      display: block;
      border: 1px solid ${theme.colors.border.weak};
      margin: 5px 0 0 0;
    `,
  };
};
