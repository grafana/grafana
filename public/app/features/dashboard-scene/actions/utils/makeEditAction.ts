import { type SceneObject } from '@grafana/scenes';

import { type DashboardActionMeta } from '../../sidebar/events';

import { edit } from './edit';

interface MakeEditActionProps<Source extends SceneObject, T extends keyof Source['state']> {
  actionId: DashboardActionMeta['actionId'];
  description: string;
  prop: T;
}

interface EditActionProps<Source extends SceneObject, T extends keyof Source['state']> {
  source: Source;
  oldValue: Source['state'][T];
  newValue: Source['state'][T];
}

export function makeEditAction<Source extends SceneObject, T extends keyof Source['state']>({
  actionId,
  description,
  prop,
}: MakeEditActionProps<Source, T>) {
  return ({ source, oldValue, newValue }: EditActionProps<Source, T>) => {
    edit({
      meta: { actionId },
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
