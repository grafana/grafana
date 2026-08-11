import { type SceneObject } from '@grafana/scenes';

import { edit } from './edit';
import { type EditActionProps, type MakeEditActionProps } from './types';

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
