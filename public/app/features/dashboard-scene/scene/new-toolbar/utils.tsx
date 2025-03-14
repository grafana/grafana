import { css } from '@emotion/css';
import { ReactNode } from 'react';

import { GrafanaTheme2 } from '@grafana/data/';
import { NavToolbarSeparator } from 'app/core/components/AppChrome/NavToolbar/NavToolbarSeparator';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';

import { DynamicDashNavButtonModel } from '../../utils/registerDynamicDashNavAction';
import { DashboardScene } from '../DashboardScene';

import { ToolbarAction } from './types';

export function renderActionElements(toolbarActions: ToolbarAction[], dashboard: DashboardScene): ReactNode[] {
  const actionElements: ReactNode[] = [];
  let lastGroup = '';

  for (const action of toolbarActions) {
    if (!action.condition) {
      continue;
    }

    if (lastGroup && lastGroup !== action.group) {
      actionElements.push(<NavToolbarSeparator key={`${action.group}-separator`} />);
    }

    actionElements.push(<action.component key={action.key} dashboard={dashboard} />);
    lastGroup = action.group;
  }

  return actionElements;
}

export function getDynamicActions(
  registeredActions: DynamicDashNavButtonModel[],
  group: string,
  condition: boolean
): ToolbarAction[] {
  const dashboard = getDashboardSrv().getCurrent()!;

  return registeredActions.reduce<ToolbarAction[]>((acc, action) => {
    const props = { dashboard };

    if (!action.show(props)) {
      return acc;
    }

    acc.push({
      key: acc.length.toString(),
      group,
      condition,
      component: () => <action.component {...props} />,
    });

    return acc;
  }, []);
}

export const getCommonActionStyles = (theme: GrafanaTheme2) => ({
  buttonWithExtraMargin: css({
    margin: theme.spacing(0, 0.5),
  }),
  switchContainer: css({
    display: 'flex',
    padding: 0,
    gap: theme.spacing(1),
    whiteSpace: 'nowrap',
  }),
});
