// Libraries
import React from 'react';
import { Resizable } from 're-resizable';
import { css, cx } from 'emotion';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';

// Services & Utils
import store from 'app/core/store';
import { stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

// Actions
import { updateQueryHistory } from '../state/actions';

// Types
import { StoreState } from 'app/types';

// Components
import { QueryHistory, SETTINGS_KEYS, Tabs } from './QueryHistory';
import { QueryHistoryQuery } from './QueryHistoryQueries';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const bg = theme.isLight ? theme.colors.gray7 : theme.colors.dark2;
  const borderColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark6;
  return {
    container: css`
      position: fixed !important;
      bottom: 0;
      background: ${bg};
      border: 1px solid ${borderColor};
    `,
    drawerActive: css`
      opacity: 1;
      transition: transform 0.3s ease-in;
    `,
    drawerNotActive: css`
      opacity: 0;
      transform: translateY(150px);
    `,
    handle: css`
      background-color: ${borderColor};
      height: 10px;
      width: 202px;
      border-radius: 10px;
      position: absolute;
      top: -5px;
      left: calc(50% - 101px);
      padding: ${theme.spacing.xs};
      cursor: grab;
      hr {
        border-top: 2px dotted ${theme.colors.gray70};
        margin: 0;
      }
    `,
  };
});

interface Props {
  queryHistory: QueryHistoryQuery[];
  updateQueryHistory: typeof updateQueryHistory;
  width: number;
  showQueryHistory: boolean;
  firstTab: Tabs;
}

function QueryHistoryContainer(props: Props) {
  const { queryHistory, updateQueryHistory, width, showQueryHistory, firstTab } = props;
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <Resizable
      className={cx(styles.container, showQueryHistory ? styles.drawerActive : styles.drawerNotActive)}
      defaultSize={{ width, height: '300px' }}
      enable={{
        top: true,
        right: false,
        bottom: false,
        left: false,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false,
      }}
      maxHeight="100vh"
      maxWidth={`${width}px`}
      minWidth={`${width}px`}
    >
      <div className={styles.handle}>
        <hr />
      </div>
      <QueryHistory queryHistory={queryHistory} onChangeQueryHistoryProperty={updateQueryHistory} firstTab={firstTab} />
    </Resizable>
  );
}

function mapStateToProps(state: StoreState) {
  const explore = state.explore;
  const firstTab = store.getBool(SETTINGS_KEYS.activeStarredTab, false) ? Tabs.Starred : Tabs.QueryHistory;
  const { queryHistory } = explore;
  return {
    queryHistory,
    firstTab,
  };
}

const mapDispatchToProps = {
  updateQueryHistory,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(QueryHistoryContainer));
