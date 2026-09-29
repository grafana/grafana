import { type SceneObject } from '@grafana/scenes';

import { type DashboardActionTracking } from '../../sidebar/events';

import { edit } from './edit';

interface MakeEditActionProps<Source extends SceneObject, T extends keyof Source['state']> {
  actionId: NonNullable<DashboardActionTracking['actionId']>;
  description: string;
  prop: T;
}

interface EditActionProps<Source extends SceneObject, T extends keyof Source['state']> {
  tracking?: DashboardActionTracking;
  source: Source;
  oldValue: Source['state'][T];
  newValue: Source['state'][T];
}

export function makeEditAction<Source extends SceneObject, T extends keyof Source['state']>({
  actionId,
  description,
  prop,
}: MakeEditActionProps<Source, T>) {
  return ({ source, oldValue, newValue, tracking }: EditActionProps<Source, T>) => {
    edit({
      tracking: { actionId, trigger: tracking?.trigger },
      description,
      source,
      perform: () => {
        source.setState({ [prop]: newValue });
      },
      undo: () => {
        source.setState({ [prop]: oldValue });
      },
    });
  };
}
