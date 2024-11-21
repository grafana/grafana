import { css, cx } from '@emotion/css';
import { useRef } from 'react';
import { useClickAway } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneObjectState,
  SceneObjectBase,
  SceneComponentProps,
  SceneObject,
  SceneObjectRef,
  sceneGraph,
  VizPanel,
} from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';
import { TOP_BAR_LEVEL_HEIGHT } from 'app/core/components/AppChrome/types';

import { getDashboardSceneFor } from '../utils/utils';

import { ElementEditPane } from './ElementEditPane';

export interface DashboardEditPaneState extends SceneObjectState {
  selectedObject?: SceneObjectRef<SceneObject>;
}

export class DashboardEditPane extends SceneObjectBase<DashboardEditPaneState> {
  private selectedHtmlElement: HTMLElement | null | undefined = null;

  public selectObject(object: SceneObject, element?: HTMLElement) {
    const current = this.state.selectedObject?.resolve();

    if (current === object) {
      this.setState({ selectedObject: undefined });
    } else {
      this.setState({ selectedObject: object.getRef() });
    }

    this.selectedHtmlElement?.classList.remove('selected-dashboard-item');
    this.selectedHtmlElement = element;

    if (this.selectedHtmlElement) {
      this.selectedHtmlElement.classList.add('selected-dashboard-item');
    }
  }

  public clearSelection() {
    if (this.state.selectedObject) {
      this.setState({ selectedObject: undefined });
    }

    if (this.selectedHtmlElement) {
      this.selectedHtmlElement.classList.remove('selected-dashboard-item');
      this.selectedHtmlElement = null;
    }
  }

  public onClick = (evt: React.MouseEvent<HTMLDivElement>) => {
    const dashboard = getDashboardSceneFor(this);
    if (!dashboard.state.isEditing) {
      return;
    }

    const target = evt.target as HTMLElement;
    const isPanel = target.closest('[data-dashboard-selectable]');
    const focusElement = target.closest('[tabindex]');

    if (!isPanel) {
      return;
    }

    const cancel = target.closest('.grid-drag-cancel');
    if (cancel) {
      return;
    }

    const panelKey = target.closest('[data-viz-panel-key]');
    if (!panelKey) {
      return;
    }

    const key = panelKey.getAttribute('data-viz-panel-key');
    if (!key) {
      return;
    }

    if (!(focusElement instanceof HTMLElement)) {
      console.log('Tried to select element that cannot be focused');
      return;
    }

    const panel = sceneGraph.findByKey(this, key);
    if (panel instanceof VizPanel) {
      this.selectObject(panel, focusElement);
    }
  };

  public onFocus = (evt: React.FocusEvent<HTMLDivElement>) => {
    // const target = evt.target as HTMLElement;
    // const focusElement = target.closest('[tabindex]');
    // const panelElement = target.closest('[data-viz-panel-key]');
    // if (!panelElement) {
    //   return;
    // }
    // const key = panelElement.getAttribute('data-viz-panel-key');
    // if (!key) {
    //   return;
    // }
    // if (!(focusElement instanceof HTMLElement)) {
    //   console.log('Tried to select element that cannot be focused');
    //   return;
    // }
    // const distance = getDistanceTo(target, panelElement);
    // if (distance > 1) {
    //   this.clearSelection();
    //   console.log('distance too far', distance);
    //   return;
    // }
    // const panel = sceneGraph.findByKey(this, key);
    // if (panel instanceof VizPanel) {
    //   this.toggleSelection(panel, focusElement);
    // }
  };

  public onClickAway = () => {
    this.setState({ selectedObject: undefined });

    if (this.selectedHtmlElement) {
      this.selectedHtmlElement?.classList.remove('selected-dashboard-item');
      this.selectedHtmlElement = null;
    }
  };

  public static Component = ({ model }: SceneComponentProps<DashboardEditPane>) => {
    const { selectedObject } = model.useState();
    const style = useStyles2(getStyles);
    const paneRef = useRef<HTMLDivElement>(null);

    useClickAway(paneRef, model.onClickAway);

    if (!selectedObject) {
      return null;
    }

    return (
      <div className={cx(style.wrapper)} ref={paneRef}>
        <ElementEditPane obj={selectedObject.resolve()} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      right: 0,
      top: TOP_BAR_LEVEL_HEIGHT * 2,
      bottom: 0,
      width: 280,
      position: 'fixed',
      background: theme.colors.background.primary,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      zIndex: theme.zIndex.modal,
      boxShadow: theme.shadows.z3,
    }),
    selected: css({
      boxShadow: `1px 1px ${theme.colors.primary.border}, -1px -1px ${theme.colors.primary.border}`,
    }),
  };
}
