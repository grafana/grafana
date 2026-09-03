import { type SceneObject } from '@grafana/scenes';

import { edit } from './edit';

interface MakeEditActionProps<Source extends SceneObject, T extends keyof Source['state']> {
  description: string;
  prop: T;
}

interface EditActionProps<Source extends SceneObject, T extends keyof Source['state']> {
  source: Source;
  oldValue: Source['state'][T];
  newValue: Source['state'][T];
}

export function makeEditAction<Source extends SceneObject, T extends keyof Source['state']>({
  description,
  prop,
}: MakeEditActionProps<Source, T>) {
  return ({ source, oldValue, newValue }: EditActionProps<Source, T>) => {
    edit({
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
