import { cx } from '@emotion/css';

import { SceneComponentProps } from '@grafana/scenes';

import { useDashboardState, useIsConditionallyHidden } from '../../utils/utils';

import { AutoGridItem } from './ResponsiveGridItem';

export interface AutoGridItemProps extends SceneComponentProps<AutoGridItem> {}

export function AutoGridItemRenderer({ model }: AutoGridItemProps) {
  const { body } = model.useState();
  const { isEditing } = useDashboardState(model);
  const isConditionallyHidden = useIsConditionallyHidden(model);

  if (isConditionallyHidden && !isEditing) {
    return null;
  }

  return model.state.repeatedPanels ? (
    <>
      {model.state.repeatedPanels.map((item) => (
        <div className={cx({ 'dashboard-visible-hidden-element': isConditionallyHidden })} key={item.state.key}>
          <item.Component model={item} />
        </div>
      ))}
    </>
  ) : (
    <div className={cx({ 'dashboard-visible-hidden-element': isConditionallyHidden })}>
      <body.Component model={body} />
    </div>
  );
}
