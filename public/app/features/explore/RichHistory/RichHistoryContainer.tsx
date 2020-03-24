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

//Actions
import { deleteRichHistory } from '../state/actions';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const containerBackground = theme.isLight ? theme.colors.gray95 : theme.colors.gray15;
  const containerBorderColor = theme.isLight ? theme.colors.gray5 : theme.colors.dark6;
  const handleBackground = theme.isLight ? theme.colors.white : theme.colors.gray15;
  const handleDots = theme.isLight ? theme.colors.gray85 : theme.colors.gray33;
  const handleBackgroundHover = theme.isLight ? theme.colors.gray85 : theme.colors.gray33;
  const handleDotsHover = theme.isLight ? theme.colors.gray70 : theme.colors.dark7;

  return {
    container: css`
      position: fixed !important;
      bottom: 0;
      background: ${containerBackground};
      border-top: 1px solid ${containerBorderColor};
      margin: 0px;
      margin-right: -${theme.spacing.md};
      margin-left: -${theme.spacing.md};
    `,
    drawerActive: css`
      opacity: 1;
      transition: transform 0.5s ease-out;
    `,
    drawerNotActive: css`
      opacity: 0;
      transform: translateY(400px);
    `,
    rzHandle: css`
      background: ${handleBackground};
      transition: 0.3s background ease-in-out;
      position: relative;
      width: 200px !important;
      left: calc(50% - 100px) !important;
      cursor: grab;
      border-radius: 4px;

      &:hover {
        background-color: ${handleBackgroundHover};

        &:after {
          border-color: ${handleDotsHover};
        }
      }

      &:after {
        content: '';
        display: block;
        height: 2px;
        position: relative;
        top: 4px;
        border-top: 4px dotted ${handleDots};
        margin: 0 4px;
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
  const [visible, setVisible] = useState(false);
  const [height, setHeight] = useState(400);

  /* To create sliding animation for rich history drawer */
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const { richHistory, width, firstTab, activeDatasourceInstance, exploreId, deleteRichHistory, onClose } = props;
  const theme = useTheme();
  const styles = getStyles(theme);
  const drawerWidth = `${width + 31.5}px`;

  return (
    <Resizable
      className={cx(styles.container, visible ? styles.drawerActive : styles.drawerNotActive)}
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
