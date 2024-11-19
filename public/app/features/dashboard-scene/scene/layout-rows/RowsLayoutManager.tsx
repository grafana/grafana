import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { Button, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { DashboardInteractions } from '../../utils/interactions';
import { ResponsiveGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { LayoutEditChrome } from '../layouts-shared/LayoutEditChrome';
import { DashboardLayoutManager, LayoutRegistryItem, LayoutEditorProps } from '../types';

import { RowItem } from './RowItem';

interface RowsLayoutManagerState extends SceneObjectState {
  rows: RowItem[];
}

export class RowsLayoutManager extends SceneObjectBase<RowsLayoutManagerState> implements DashboardLayoutManager {
  public editModeChanged(isEditing: boolean): void {}

  public addPanel(vizPanel: VizPanel): void {}

  public addNewRow(): void {
    this.setState({
      rows: [
        ...this.state.rows,
        new RowItem({
          title: 'New row',
          layout: ResponsiveGridLayoutManager.createEmpty(),
        }),
      ],
    });
  }

  public getNextPanelId(): number {
    return 0;
  }

  public removePanel(panel: VizPanel) {
    //const element = panel.parent;
    //this.state.layout.setState({ children: this.state.layout.state.children.filter((child) => child !== element) });
  }

  public duplicatePanel(panel: VizPanel): void {
    throw new Error('Method not implemented.');
  }

  public getVizPanels(): VizPanel[] {
    const panels: VizPanel[] = [];

    for (const row of this.state.rows) {
      const innerPanels = row.state.layout.getVizPanels();
      panels.push(...innerPanels);
    }

    return panels;
  }

  public renderEditor() {
    return <RowsLayoutEditor layoutManager={this} />;
  }

  public getDescriptor(): LayoutRegistryItem {
    return RowsLayoutManager.getDescriptor();
  }

  public static getDescriptor(): LayoutRegistryItem {
    return {
      name: 'Rows',
      description: 'Rows layout',
      id: 'rows-layout',
      createFromLayout: RowsLayoutManager.createFromLayout,
    };
  }

  public static createEmpty() {
    return new RowsLayoutManager({ rows: [] });
  }

  public static createFromLayout(layout: DashboardLayoutManager): RowsLayoutManager {
    const row = new RowItem({ layout: layout.clone(), title: 'Row title' });

    return new RowsLayoutManager({ rows: [row] });
  }

  public static Component = ({ model }: SceneComponentProps<RowsLayoutManager>) => {
    const { rows } = model.useState();
    const styles = useStyles2(getStyles);

    return (
      <LayoutEditChrome layoutManager={model}>
        <div className={styles.wrapper}>
          {rows.map((row) => (
            <RowItem.Component model={row} key={row.state.key!} />
          ))}
        </div>
      </LayoutEditChrome>
    );
  };
}

function RowsLayoutEditor({ layoutManager }: LayoutEditorProps<RowsLayoutManager>) {
  return (
    <>
      <Button
        fill="outline"
        icon="plus"
        onClick={() => {
          layoutManager.addNewRow();
          DashboardInteractions.toolbarAddButtonClicked({ item: 'add_row' });
        }}
      >
        <Trans i18nKey="dashboard.add-menu.row">Row</Trans>
      </Button>
    </>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
    }),
  };
}
