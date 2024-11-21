import { css } from '@emotion/css';
import { useMemo, useRef } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { SceneObjectState, SceneObjectBase, SceneComponentProps, sceneGraph } from '@grafana/scenes';
import { Button, Icon, Input, useStyles2 } from '@grafana/ui';
import { OptionsPaneCategoryDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategoryDescriptor';
import { OptionsPaneItemDescriptor } from 'app/features/dashboard/components/PanelEditor/OptionsPaneItemDescriptor';

import { getDashboardSceneFor, getDefaultVizPanel } from '../../utils/utils';
import { useLayoutCategory } from '../layouts-shared/DashboardLayoutSelector';
import { DashboardLayoutManager, EditableDashboardElement, LayoutParent } from '../types';

import { RowsLayoutManager } from './RowsLayoutManager';

export interface RowItemState extends SceneObjectState {
  layout: DashboardLayoutManager;
  title?: string;
  isCollapsed?: boolean;
}

export class RowItem extends SceneObjectBase<RowItemState> implements LayoutParent, EditableDashboardElement {
  public isEditableDashboardElement: true = true;

  public useEditPaneOptions(): OptionsPaneCategoryDescriptor[] {
    const row = this;

    const rowOptions = useMemo(() => {
      return new OptionsPaneCategoryDescriptor({
        title: 'Row options',
        id: 'row-options',
        isOpenDefault: true,
      }).addItem(
        new OptionsPaneItemDescriptor({
          title: 'Title',
          value: row.state.title,
          render: () => <RowTitleInput row={row} />,
        })
      );
    }, [row]);

    const { layout } = this.useState();
    const layoutOptions = useLayoutCategory(layout);

    return [rowOptions, layoutOptions];
  }

  public getTypeName(): string {
    return 'Row';
  }

  public onDelete() {
    const layout = sceneGraph.getAncestor(this, RowsLayoutManager);
    layout.removeRow(this);
  }

  public renderActions(): React.ReactNode {
    return (
      <>
        <Button size="sm" variant="secondary">
          Copy
        </Button>
        <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete}>
          Delete
        </Button>
      </>
    );
  }

  public getLayout(): DashboardLayoutManager {
    return this.state.layout;
  }

  public switchLayout(layout: DashboardLayoutManager): void {
    this.setState({ layout });
  }

  public onCollapseToggle = () => {
    this.setState({ isCollapsed: !this.state.isCollapsed });
  };

  public onAddPanel = () => {
    const vizPanel = getDefaultVizPanel();
    this.state.layout.addPanel(vizPanel);
  };

  public onEdit = (domElement: HTMLDivElement) => {
    const dashboard = getDashboardSceneFor(this);
    dashboard.state.editPane.selectObject(this, domElement);
  };

  public static Component = ({ model }: SceneComponentProps<RowItem>) => {
    const { layout, title, isCollapsed } = model.useState();
    const { isEditing } = getDashboardSceneFor(model).useState();
    const styles = useStyles2(getStyles);
    const titleInterpolated = sceneGraph.interpolate(model, title, undefined, 'text');
    const ref = useRef<HTMLDivElement>(null);

    return (
      <div className={styles.wrapper} ref={ref} style={{ flexGrow: isCollapsed ? 0 : 1 }}>
        <div className={styles.rowHeader}>
          <button
            onClick={model.onCollapseToggle}
            className={styles.rowTitleButton}
            aria-label={isCollapsed ? 'Expand row' : 'Collapse row'}
            data-testid={selectors.components.DashboardRow.title(titleInterpolated)}
          >
            <Icon name={isCollapsed ? 'angle-right' : 'angle-down'} />
            <span className={styles.rowTitle} role="heading">
              {titleInterpolated}
            </span>
          </button>
          {isEditing && (
            <Button icon="pen" variant="secondary" size="sm" fill="text" onClick={() => model.onEdit(ref.current!)} />
          )}
        </div>
        {!isCollapsed && <layout.Component model={layout} />}
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
      alignItems: 'center',
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
    rowTitleButton: css({
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      background: 'transparent',
      border: 'none',
      minWidth: 0,
      gap: theme.spacing(1),
    }),
    rowCollapsed: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    rowTitle: css({
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '100%',
      flexGrow: 1,
      minWidth: 0,
    }),
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
    }),
    rowActions: css({
      display: 'flex',
      opacity: 0,
    }),
  };
}

export function RowTitleInput({ row }: { row: RowItem }) {
  const { title } = row.useState();

  return <Input value={title} onChange={(e) => row.setState({ title: e.currentTarget.value })} />;
}
