// Libraries
import React, { useState, useEffect } from 'react';
import { Resizable } from 're-resizable';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { css, cx } from 'emotion';

// Services & Utils
import store from 'app/core/store';
import { stylesFactory, useTheme } from '@grafana/ui';
import { RICH_HISTORY_SETTING_KEYS } from 'app/core/utils/richHistory';

// Types
import { StoreState } from 'app/types';
import { GrafanaTheme } from '@grafana/data';
import { ExploreId, RichHistoryQuery } from 'app/types/explore';

// Components, enums
import { RichHistory, Tabs } from './RichHistory';

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
  width: number;
  exploreId: ExploreId;
  activeDatasourceInstance: string;
  richHistory: RichHistoryQuery[];
  firstTab: Tabs;
}

function RichHistoryContainer(props: Props) {
  const [visible, setVisible] = useState(false);

  /* To create sliding animation for rich history drawer */
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const { richHistory, width, firstTab, activeDatasourceInstance, exploreId } = props;
  const theme = useTheme();
  const styles = getStyles(theme);

  const drawerHandle = (
    <div className={styles.handle}>
      <hr />
    </div>
  );

  return (
    <Resizable
      className={cx(styles.container, visible ? styles.drawerActive : styles.drawerNotActive)}
      defaultSize={{ width, height: '400px' }}
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
      {drawerHandle}
      <RichHistory
        richHistory={richHistory}
        firstTab={firstTab}
        activeDatasourceInstance={activeDatasourceInstance}
        exploreId={exploreId}
      />
    </Resizable>
  );
}

function mapStateToProps(state: StoreState, { exploreId }: { exploreId: ExploreId }) {
  const explore = state.explore;
  // @ts-ignore
  const item: ExploreItemState = explore[exploreId];
  const { datasourceInstance } = item;
  const firstTab = store.getBool(RICH_HISTORY_SETTING_KEYS.starredTabAsFirstTab, false)
    ? Tabs.Starred
    : Tabs.RichHistory;
  const { richHistory } = explore;
  return {
    richHistory,
    firstTab,
    activeDatasourceInstance: datasourceInstance?.name,
  };
}

export default hot(module)(connect(mapStateToProps)(RichHistoryContainer));
