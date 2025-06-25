import { t } from '@grafana/i18n';
import { sceneGraph, SceneGridRow, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import appEvents from 'app/core/app_events';
import { ShowConfirmModalEvent } from 'app/types/events';

import { DefaultGridLayoutManager } from '../DefaultGridLayoutManager';
import { RowRepeaterBehavior } from '../RowRepeaterBehavior';

import { RowActionsRenderer } from './RowActionsRenderer';

export interface RowActionsState extends SceneObjectState {}

export class RowActions extends SceneObjectBase<RowActionsState> {
  static Component = RowActionsRenderer;

  public getParent(): SceneGridRow {
    if (!(this.parent instanceof SceneGridRow)) {
      throw new Error('RowActions must have a SceneGridRow parent');
    }

    return this.parent;
  }

  public removeRow(removePanels?: boolean) {
    const manager = sceneGraph.getAncestor(this, DefaultGridLayoutManager);
    manager.removeRow(this.getParent(), removePanels);
  }

  public onUpdate(title: string, repeat: string | null | undefined) {
    const row = this.getParent();
    let repeatBehavior: RowRepeaterBehavior | undefined;

    if (row.state.$behaviors) {
      for (let b of row.state.$behaviors) {
        if (b instanceof RowRepeaterBehavior) {
          repeatBehavior = b;
        }
      }
    }

    if (title !== row.state.title) {
      row.setState({ title });
    }

    if (repeat) {
      // Remove repeat behavior if it exists to re-trigger repeat when adding new one
      if (repeatBehavior) {
        repeatBehavior.removeBehavior();
      }

      repeatBehavior = new RowRepeaterBehavior({ variableName: repeat });
      row.setState({ $behaviors: [...(row.state.$behaviors ?? []), repeatBehavior] });
    } else {
      repeatBehavior?.removeBehavior();
    }
  }

  public onDelete() {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: t('dashboard.default-layout.row-actions.modal.title', 'Delete row'),
        text: t(
          'dashboard.default-layout.row-actions.modal.text',
          'Are you sure you want to remove this row and all its panels?'
        ),
        altActionText: t('dashboard.default-layout.row-actions.modal.alt-action', 'Delete row only'),
        icon: 'trash-alt',
        onConfirm: () => this.removeRow(true),
        onAltAction: () => this.removeRow(),
      })
    );
  }
}
