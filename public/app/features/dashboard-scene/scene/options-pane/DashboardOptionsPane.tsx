import { css, cx } from '@emotion/css';
import { useRef } from 'react';
import { useClickAway } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, SceneObjectBase, SceneComponentProps, SceneObject } from '@grafana/scenes';
import { Button, Field, Input, Stack, useStyles2 } from '@grafana/ui';
import { TOP_BAR_LEVEL_HEIGHT } from 'app/core/components/AppChrome/types';

import { OptionsPaneSection } from './OptionsPaneSection';

export interface DashboardOptionsPaneState extends SceneObjectState {
  selectedObject?: SceneObject;
}

export class DashboardOptionsPane extends SceneObjectBase<DashboardOptionsPaneState> {
  public constructor(state: DashboardOptionsPaneState) {
    super(state);
    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {}

  public toggleSelection(object: SceneObject) {
    if (this.state.selectedObject === object) {
      this.setState({ selectedObject: undefined });
    } else {
      this.setState({ selectedObject: object });
    }
  }

  public onClickAway = () => {
    console.log('click away');
    this.setState({ selectedObject: undefined });
  };

  public static Component = ({ model }: SceneComponentProps<DashboardOptionsPane>) => {
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
