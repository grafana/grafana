import { cx } from '@emotion/css';
import { useMemo } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Icon, useElementSelection, useStyles2 } from '@grafana/ui';

import { isRepeatCloneOrChildOf } from '../../utils/clone';
import { DashboardInteractions } from '../../utils/interactions';
import { type DashboardEditPane } from '../DashboardEditPane';
import { getEditableElementFor } from '../shared';
import { useOutlineRename } from '../useOutlineRename';

import { DashboardOutlineNodeButtonContent } from './DashboardOutlineNodeButtonContent';
import { getCommonStyles } from './styles';
import { type FlattenedOutlineNode, getOutlineInstanceName, selectOutlineObject } from './utils';

interface DashboardOutlineSearchResultNodeProps {
  node: FlattenedOutlineNode;
  resultIndex: number;
  editPane: DashboardEditPane;
  isEditing: boolean | undefined;
}

export function DashboardOutlineSearchResultNode({
  node,
  resultIndex,
  editPane,
  isEditing,
}: DashboardOutlineSearchResultNodeProps) {
  const commonStyles = useStyles2(getCommonStyles);
  const key = node.sceneObject.state.key;
  const { isSelected, onSelect } = useElementSelection(key);
  const editableElement = useMemo(() => getEditableElementFor(node.sceneObject)!, [node.sceneObject]);
  const elementInfo = editableElement.getEditableElementInfo();
  const noTitleText = t('dashboard.outline.tree-item.no-title', '<no title>');
  const instanceName = getOutlineInstanceName(elementInfo.instanceName, noTitleText);
  const outlineRename = useOutlineRename(editableElement, isEditing);
  const isCloned = useMemo(() => isRepeatCloneOrChildOf(node.sceneObject), [node.sceneObject]);

  const onNodeClicked = (e: React.MouseEvent) => {
    e.stopPropagation();

    selectOutlineObject(node.sceneObject, editPane, isSelected ?? false, onSelect, e);

    editableElement.scrollIntoView?.();
    DashboardInteractions.outlineItemClicked({ index: resultIndex, depth: node.depth, isEditing });
  };

  return (
    // todo: add proper keyboard navigation
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events
    <li role="treeitem" aria-selected={isSelected} className={commonStyles.wrapper} onClick={onNodeClicked}>
      <div
        className={cx(commonStyles.row, isEditing ? commonStyles.rowEditMode : commonStyles.rowViewMode, {
          [commonStyles.rowSelected]: isSelected,
        })}
      >
        <button
          className={cx(commonStyles.nodeButton, { [commonStyles.nodeButtonClone]: isCloned })}
          onDoubleClick={outlineRename.onNameDoubleClicked}
          data-testid={selectors.components.PanelEditor.Outline.item(instanceName)}
        >
          <Icon size="sm" name={elementInfo.icon} />
          <DashboardOutlineNodeButtonContent
            elementInfo={elementInfo}
            instanceName={instanceName}
            isCloned={isCloned}
            isRenaming={outlineRename.isRenaming}
            renameInputRef={outlineRename.renameInputRef}
            onChangeName={outlineRename.onChangeName}
            onInputBlur={outlineRename.onInputBlur}
            onInputKeyDown={outlineRename.onInputKeyDown}
          />
        </button>
      </div>
    </li>
  );
}
