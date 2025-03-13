import classNames from 'classnames';

import { SceneComponentProps } from '@grafana/scenes';

import { useDashboardState, useIsConditionallyHidden } from '../../utils/utils';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export interface ResponsiveGridItemProps extends SceneComponentProps<ResponsiveGridItem> {}

export function ResponsiveGridItemRenderer({ model }: ResponsiveGridItemProps) {
  const { body } = model.useState();
  // const style = useStyles2(getStyles);
  const { showHiddenElements } = useDashboardState(model);
  const isConditionallyHidden = useIsConditionallyHidden(model);

  if (isConditionallyHidden && !showHiddenElements) {
    return null;
  }
  const isHiddenButVisibleElement = showHiddenElements && isConditionallyHidden;

  return model.state.repeatedPanels ? (
    <>
      {model.state.repeatedPanels.map((item) => (
        <div
          className={classNames({ 'dashboard-visible-hidden-element': isHiddenButVisibleElement })}
          key={item.state.key}
        >
          <item.Component model={item} />
        </div>
      ))}
    </>
  ) : (
    <div className={classNames({ 'dashboard-visible-hidden-element': isHiddenButVisibleElement })}>
      <body.Component model={body} />
    </div>
  );
}
