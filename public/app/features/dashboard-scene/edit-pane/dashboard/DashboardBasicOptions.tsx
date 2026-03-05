import { useRef } from 'react';

import { Input, TextArea } from '@grafana/ui';

import { DashboardScene } from '../../scene/DashboardScene';
import { dashboardEditActions } from '../shared';

export function DashboardTitleInput({ dashboard, id }: { dashboard: DashboardScene; id?: string }) {
  const { title } = dashboard.useState();

  // We want to save the unchanged value for the 'undo' action
  const valueBeforeEdit = useRef('');

  return (
    <Input
      id={id}
      value={title}
      onChange={(e) => {
        dashboard.setState({ title: e.currentTarget.value });
      }}
      onFocus={(e) => {
        valueBeforeEdit.current = e.currentTarget.value;
      }}
      onBlur={(e) => {
        const titleUnchanged = valueBeforeEdit.current === e.currentTarget.value;
        const shouldSkip = titleUnchanged;
        if (shouldSkip) {
          return;
        }

        dashboardEditActions.changeTitle({
          source: dashboard,
          oldValue: valueBeforeEdit.current,
          newValue: e.currentTarget.value,
        });
      }}
    />
  );
}

export function DashboardDescriptionInput({ dashboard, id }: { dashboard: DashboardScene; id?: string }) {
  const { description } = dashboard.useState();

  // We want to save the unchanged value for the 'undo' action
  const valueBeforeEdit = useRef('');

  return (
    <TextArea
      id={id}
      value={description}
      onChange={(e) => dashboard.setState({ description: e.currentTarget.value })}
      onFocus={(e) => {
        valueBeforeEdit.current = e.currentTarget.value;
      }}
      onBlur={(e) => {
        const descriptionUnchanged = valueBeforeEdit.current === e.currentTarget.value;
        const shouldSkip = descriptionUnchanged;
        if (shouldSkip) {
          return;
        }

        dashboardEditActions.changeDescription({
          source: dashboard,
          oldValue: valueBeforeEdit.current,
          newValue: e.currentTarget.value,
        });
      }}
    />
  );
}
