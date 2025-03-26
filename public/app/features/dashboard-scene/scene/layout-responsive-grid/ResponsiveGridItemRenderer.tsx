import { cx } from '@emotion/css';

import { SceneComponentProps } from '@grafana/scenes';

import { useDashboardState, useIsConditionallyHidden } from '../../utils/utils';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export interface ResponsiveGridItemProps extends SceneComponentProps<ResponsiveGridItem> {}

export function ResponsiveGridItemRenderer({ model }: ResponsiveGridItemProps) {
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
