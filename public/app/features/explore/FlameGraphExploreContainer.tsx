import { css } from '@emotion/css';
import React from 'react';

import { DataFrame, GrafanaTheme2, CoreApp, DataSourceApi } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import FlameGraphContainer from '../../plugins/panel/flamegraph/components/FlameGraphContainer';

interface Props {
  dataFrames: DataFrame[];
  datasource?: DataSourceApi | null;
}

export const FlameGraphExploreContainer = (props: Props) => {
  const styles = useStyles2((theme) => getStyles(theme));

  return (
    <div className={styles.container}>
      <FlameGraphContainer data={props.dataFrames[0]} app={CoreApp.Explore} datasource={props.datasource} />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    background: ${theme.colors.background.primary};
    display: flow-root;
    padding: 0 ${theme.spacing(1)} ${theme.spacing(1)} ${theme.spacing(1)};
    border: 1px solid ${theme.components.panel.borderColor};
    border-radius: ${theme.shape.borderRadius(1)};
  `,
});
