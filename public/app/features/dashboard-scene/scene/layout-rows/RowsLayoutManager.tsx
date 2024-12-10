import { css } from '@emotion/css';
import { useContext, useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { SceneComponentProps, SceneObjectBase, SceneObjectState, VizPanel } from '@grafana/scenes';
import { ElementSelectionContext, ElementSelectionContextState, useStyles2 } from '@grafana/ui';

import { ResponsiveGridLayoutManager } from '../layout-responsive-grid/ResponsiveGridLayoutManager';
import { DashboardLayoutManager, LayoutRegistryItem } from '../types';

import { RowItem } from './RowItem';

interface RowsLayoutManagerState extends SceneObjectState {
  rows: RowItem[];
}

export class RowsLayoutManager extends SceneObjectBase<RowsLayoutManagerState> implements DashboardLayoutManager {
  public isDashboardLayoutManager: true = true;

  private _context: ElementSelectionContextState | undefined;

  public editModeChanged(isEditing: boolean): void {}

  public addPanel(vizPanel: VizPanel): void {
    // Try to add new panels to all selected rows
    if (this._context?.enabled && this._context?.selected.length > 0) {
      return this.state.rows
        .filter((r) => this._context?.selected.some((s) => s.id === r.state.key))
        .forEach((r) => {
          r.onAddPanel(vizPanel.clone());
        });
    }

    // If we don't have selected rows but a single row, add to it
    if (this.state.rows.length === 1) {
      return this.state.rows[0].onAddPanel(vizPanel);
    }

    // Otherwise fallback to adding a new row and a panel
    this.addNewRow();
    this.state.rows[this.state.rows.length - 1].onAddPanel(vizPanel);
  }

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

  public removePanel(panel: VizPanel) {}

  public removeRow(row: RowItem) {
    this.setState({
      rows: this.state.rows.filter((r) => r !== row),
    });
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

  public getOptions() {
    return [];
  }

  public getDescriptor(): LayoutRegistryItem {
    return RowsLayoutManager.getDescriptor();
  }

  public setContext(context: ElementSelectionContextState | undefined) {
    this._context = context;
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
    const ctx = useContext(ElementSelectionContext);

    useEffect(() => {
      model.setContext(ctx);
    }, [model, ctx]);

    return (
      <div className={styles.wrapper}>
        {rows.map((row) => (
          <RowItem.Component model={row} key={row.state.key!} />
        ))}
      </div>
    );
  };
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      height: '100%',
      width: '100%',
    }),
  };
}
