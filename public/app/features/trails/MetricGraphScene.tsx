import { css } from '@emotion/css';

import { DashboardCursorSync, GrafanaTheme2 } from '@grafana/data';
import { useChromeHeaderHeight } from '@grafana/runtime';
import {
  behaviors,
  SceneComponentProps,
  SceneFlexItem,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { MetricActionBar } from './MetricScene';
import { AutoVizPanel } from './autoQuery/components/AutoVizPanel';
import { getTrailFor, getTrailSettings } from './utils';

export const MAIN_PANEL_MIN_HEIGHT = 280;
export const MAIN_PANEL_MAX_HEIGHT = '40%';

export interface MetricGraphSceneState extends SceneObjectState {
  topView: SceneFlexLayout;
  selectedTab?: SceneObject;
}

export class MetricGraphScene extends SceneObjectBase<MetricGraphSceneState> {
  public constructor(state: Partial<MetricGraphSceneState>) {
    super({
      topView: state.topView ?? buildGraphTopView(),
      ...state,
    });
  }

  public static Component = ({ model }: SceneComponentProps<MetricGraphScene>) => {
    const { topView, selectedTab } = model.useState();
    const { stickyMainGraph } = getTrailSettings(model).useState();
    const chromeHeaderHeight = useChromeHeaderHeight();
    const trail = getTrailFor(model);
    const styles = useStyles2(getStyles, trail.state.embedded ? 0 : (chromeHeaderHeight ?? 0));

    return (
      <div className={styles.container}>
        <div className={stickyMainGraph ? styles.sticky : styles.nonSticky}>
          <topView.Component model={topView} />
        </div>
        {selectedTab && <selectedTab.Component model={selectedTab} />}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2, chromeHeaderHeight: number) {
  return {
    container: css({
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }),
    sticky: css({
      display: 'flex',
      flexDirection: 'row',
      background: theme.isLight ? theme.colors.background.primary : theme.colors.background.canvas,
      position: 'sticky',
      paddingTop: theme.spacing(1),
      marginTop: `-${theme.spacing(1)}`,
      top: `${chromeHeaderHeight + 70}px`,
      zIndex: 10,
    }),
    nonSticky: css({
      display: 'flex',
      flexDirection: 'row',
    }),
  };
}

function buildGraphTopView() {
  return new SceneFlexLayout({
    direction: 'column',
    $behaviors: [new behaviors.CursorSync({ key: 'metricCrosshairSync', sync: DashboardCursorSync.Crosshair })],
    children: [
      new SceneFlexItem({
        minHeight: MAIN_PANEL_MIN_HEIGHT,
        maxHeight: MAIN_PANEL_MAX_HEIGHT,
        body: new AutoVizPanel({}),
      }),
      new SceneFlexItem({
        ySizing: 'content',
        body: new MetricActionBar({}),
      }),
    ],
  });
}
