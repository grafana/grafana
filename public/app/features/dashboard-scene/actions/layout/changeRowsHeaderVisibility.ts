import { t } from '@grafana/i18n';
import { type SceneObject } from '@grafana/scenes';

import { type RowItem } from '../../scene/layout-rows/RowItem';
import { edit } from '../utils/edit';

interface ChangeRowsHeaderVisibilityActionProps {
  source: SceneObject;
  rows: RowItem[];
  hideHeader: boolean;
}

export function changeRowsHeaderVisibility({ source, rows, hideHeader }: ChangeRowsHeaderVisibilityActionProps) {
  const previousValues = rows.map((row) => row.state.hideHeader);

  edit({
    meta: { actionId: 'row.changeHeaderVisibility', scope: 'multiple' },
    description: hideHeader
      ? t('dashboard.edit-actions.rows-hide-header', 'Hide row headers')
      : t('dashboard.edit-actions.rows-show-header', 'Show row headers'),
    source,
    perform: () => rows.forEach((row) => row.onHeaderHiddenToggle(hideHeader)),
    undo: () => rows.forEach((row, index) => row.setState({ hideHeader: previousValues[index] })),
  });
}
