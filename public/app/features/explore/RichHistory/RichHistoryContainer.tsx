// Libraries
import React, { useState } from 'react';
import { Resizable } from 're-resizable';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { css, cx, keyframes } from 'emotion';

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

//Actions
import { deleteRichHistory } from '../state/actions';

const drawerSlide = keyframes`
  0% {
    transform: translateY(400px);
  }

  100% {
    transform: translateY(0px);
  }
`;

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const shadowColor = theme.isLight ? theme.palette.gray4 : theme.palette.black;

  return {
    container: css`
      position: fixed !important;
      bottom: 0;
      background: ${theme.colors.pageHeaderBg};
      border-top: 1px solid ${theme.colors.formInputBorder};
      margin: 0px;
      margin-right: -${theme.spacing.md};
      margin-left: -${theme.spacing.md};
      box-shadow: 0 0 4px ${shadowColor};
      z-index: ${theme.zIndex.sidemenu};
    `,
    drawerActive: css`
      opacity: 1;
      animation: 0.5s ease-out ${drawerSlide};
    `,
    rzHandle: css`
      background: ${theme.colors.formInputBorder};
      transition: 0.3s background ease-in-out;
      position: relative;
      width: 200px !important;
      height: 7px !important;
      left: calc(50% - 100px) !important;
      top: -4px !important;
      cursor: grab;
      border-radius: 4px;
      &:hover {
        background: ${theme.colors.formInputBorderHover};
      }
    `,
  };
});

export interface Props {
  width: number;
  exploreId: ExploreId;
  activeDatasourceInstance: string;
  richHistory: RichHistoryQuery[];
  firstTab: Tabs;
  deleteRichHistory: typeof deleteRichHistory;
  onClose: () => void;
}

export function RichHistoryContainer(props: Props) {
  const [height, setHeight] = useState(400);

  const { richHistory, width, firstTab, activeDatasourceInstance, exploreId, deleteRichHistory, onClose } = props;
  const theme = useTheme();
  const styles = getStyles(theme);
  const drawerWidth = `${width + 31.5}px`;

  return (
    <Resizable
      className={cx(styles.container, styles.drawerActive)}
      defaultSize={{ width: drawerWidth, height: '400px' }}
      handleClasses={{ top: styles.rzHandle }}
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
      maxWidth={drawerWidth}
      minWidth={drawerWidth}
      onResize={(e, dir, ref) => {
        setHeight(Number(ref.style.height.slice(0, -2)));
      }}
    >
      <RichHistory
        richHistory={richHistory}
        firstTab={firstTab}
        activeDatasourceInstance={activeDatasourceInstance}
        exploreId={exploreId}
        deleteRichHistory={deleteRichHistory}
        onClose={onClose}
        height={height}
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

const mapDispatchToProps = {
  deleteRichHistory,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(RichHistoryContainer));
