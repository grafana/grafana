import { css, cx } from '@emotion/css';
import { debounce } from 'lodash';
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
import { Button, Field, Input, Stack, useStyles2 } from '@grafana/ui';
import { TOP_BAR_LEVEL_HEIGHT } from 'app/core/components/AppChrome/types';

import { OptionsPaneSection } from './OptionsPaneSection';

export interface DashboardEditPaneState extends SceneObjectState {
  selectedObject?: SceneObjectRef<SceneObject>;
}

export class DashboardEditPane extends SceneObjectBase<DashboardEditPaneState> {
  private selectedElement: HTMLElement | null = null;
  private selectedTime = 0;

  public constructor(state: DashboardEditPaneState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {}

  public toggleSelection(object: SceneObject, element: HTMLElement) {
    const currentTime = Date.now().valueOf();
    const current = this.state.selectedObject?.resolve();

    if (currentTime - this.selectedTime < 10) {
      console.log('ignore click');
      return;
    }

    if (current === object) {
      this.setState({ selectedObject: undefined });
    } else {
      this.setState({ selectedObject: object.getRef() });
    }

    this.selectedElement?.classList.remove('selected-dashboard-item');

    this.selectedElement = element;
    this.selectedElement.classList.add('selected-dashboard-item');
    this.selectedTime = Date.now().valueOf();
  }

  public onClick = (evt: React.MouseEvent<HTMLDivElement>) => {
    const target = evt.target as HTMLElement;
    const isPanel = target.closest('.grid-item-drag-handle');
    const focusElement = target.closest('[tabindex]');

    if (!isPanel) {
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
      this.toggleSelection(panel, focusElement);
    }
  };

  public onFocus = (evt: React.FocusEvent<HTMLDivElement>) => {
    const target = evt.target as HTMLElement;
    const focusElement = target.closest('[tabindex]');
    const panelElement = target.closest('[data-viz-panel-key]');
    if (!panelElement) {
      return;
    }

    const key = panelElement.getAttribute('data-viz-panel-key');
    if (!key) {
      return;
    }

    if (!(focusElement instanceof HTMLElement)) {
      console.log('Tried to select element that cannot be focused');
      return;
    }

    const distance = getDistanceTo(target, panelElement);
    if (distance > 1) {
      console.log('distance too far', distance);
      return;
    }

    const panel = sceneGraph.findByKey(this, key);
    if (panel instanceof VizPanel) {
      this.toggleSelection(panel, focusElement);
    }
  };

  public onClickAway = () => {
    this.setState({ selectedObject: undefined });

    if (this.selectedElement) {
      this.selectedElement?.classList.remove('selected-dashboard-item');
      this.selectedElement = null;
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
        <OptionsPaneSection title="Actions">
          <Stack direction="row" gap={1} alignItems={'center'} justifyContent={'center'}>
            <Button size="sm" icon="pen">
              Edit
            </Button>
            <Button size="sm" variant="destructive" icon="trash-alt">
              Delete
            </Button>
          </Stack>
        </OptionsPaneSection>
        <OptionsPaneSection title="Layout options">
          <Field label="Repeat by">
            <Input />
          </Field>
        </OptionsPaneSection>
        <OptionsPaneSection title="Panel options">
          <Field label="Title">
            <Input />
          </Field>
        </OptionsPaneSection>
        <OptionsPaneSection title="Visualization options">
          <Field label="Display">
            <Input />
          </Field>
        </OptionsPaneSection>
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
      padding: theme.spacing(1),
      zIndex: theme.zIndex.modal,
      boxShadow: theme.shadows.z3,
    }),
    selected: css({
      boxShadow: `1px 1px ${theme.colors.primary.border}, -1px -1px ${theme.colors.primary.border}`,
    }),
  };
}

function getDistanceTo(source: Element, ancestor: Element) {
  if (source === ancestor) {
    return 0;
  }

  if (!source.parentElement) {
    return 100;
  }

  return 1 + getDistanceTo(source.parentElement, ancestor);
}
