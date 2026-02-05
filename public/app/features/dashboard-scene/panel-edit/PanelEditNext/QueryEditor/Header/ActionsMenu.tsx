import { CoreApp } from '@grafana/data';

import { QueryEditorType } from '../../constants';
import { useQueryEditorUIContext } from '../QueryEditorContext';

import { QueryActionsMenu } from './QueryActionsMenu';
import { TransformationActionsMenu } from './TransformationActionsMenu';

interface ActionsMenuProps {
  app?: CoreApp;
}

export function ActionsMenu({ app }: ActionsMenuProps) {
  const { cardType } = useQueryEditorUIContext();

  if (cardType === QueryEditorType.Transformation) {
    return <TransformationActionsMenu />;
  }

  // Queries and expressions use the same menu
  return <QueryActionsMenu app={app} />;
}
