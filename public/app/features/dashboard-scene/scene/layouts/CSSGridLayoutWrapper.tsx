import {
  SceneComponentProps,
  SceneCSSGridLayout,
  SceneGridLayout,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { Field, Input } from '@grafana/ui';

import { LayoutEditorProps } from './types';

interface CSSGridLayoutWrapperState extends SceneObjectState {
  innerLayout: SceneCSSGridLayout;
}

export class CSSGridLayoutWrapper extends SceneObjectBase<CSSGridLayoutWrapperState> {
  static Component = CSSGridLayoutWrapperRenderer;
}

function CSSGridLayoutWrapperRenderer({ model }: SceneComponentProps<CSSGridLayoutWrapper>) {
  return <model.state.innerLayout.Component model={model.state.innerLayout} />;
}

function AutomaticGridEditor(props: LayoutEditorProps<SceneGridLayout>) {
  return (
    <>
      <Field label="Grid template">
        <Input type="text" />
      </Field>
    </>
  );
}
