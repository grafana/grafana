import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneObjectState, SceneObjectBase, SceneComponentProps } from '@grafana/scenes';
import { Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { getDashboardSceneFor, getDefaultVizPanel } from '../../utils/utils';
import { DashboardLayoutManager, LayoutParent } from '../types';

export interface RowItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
}

export class RowItem extends SceneObjectBase<RowItemState> implements LayoutParent {
  public switchLayout(layout: DashboardLayoutManager): void {
    this.setState({ layout });
  }

  public onAddPanel = () => {
    const vizPanel = getDefaultVizPanel();
    this.state.layout.addPanel(vizPanel);
  };

  public static Component = ({ model }: SceneComponentProps<RowItem>) => {
    const { layout, title } = model.useState();
    const { isEditing } = getDashboardSceneFor(model).useState();
    const styles = useStyles2(getStyles);

    return (
      <div className={styles.wrapper}>
        <div className={styles.rowHeader}>
          <Stack gap={2}>{title && <Text variant="h5">{title}</Text>}</Stack>
          {isEditing && <Button icon="pen" variant="secondary" size="sm" fill="text" />}
          {isEditing && <Button icon="trash-alt" variant="destructive" size="sm" fill="text" />}
        </div>

        <layout.Component model={layout} />
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    rowHeader: css({
      width: '100%',
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(0, 1, 0.5, 1),
      margin: theme.spacing(0, 0, 1, 0),
      alignItems: 'flex-end',
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      paddingBottom: theme.spacing(1),

      '&:hover, &:focus-within': {
        '& > div': {
          opacity: 1,
        },
      },

      '& > div': {
        marginBottom: 0,
        marginRight: theme.spacing(1),
      },
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      flex: '1 1 0',
      width: '100%',
    }),
    rowActions: css({
      display: 'flex',
      opacity: 0,
    }),
  };
}
