import { CoreApp } from '@grafana/data';

import { QueryEditorType } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';

import { QueryActionsMenu } from './QueryActionsMenu';
import { TransformationActionsMenu } from './TransformationActionsMenu';

interface ActionsMenuProps {
  app?: CoreApp;
}

/**
 * Router component that delegates to the appropriate actions menu
 * based on the currently selected editor type (query vs transformation).
 *
 * @remarks
 * This component simply reads cardType from context and renders the
 * appropriate specialized menu component. All menu logic is contained
 * in the specialized components.
 */
export function ActionsMenu({ app }: ActionsMenuProps) {
  const { cardType } = useQueryEditorUIContext();

  if (cardType === QueryEditorType.Transformation) {
    return <TransformationActionsMenu />;
  }

  // Queries and expressions use the same menu
  return <QueryActionsMenu app={app} />;
}
