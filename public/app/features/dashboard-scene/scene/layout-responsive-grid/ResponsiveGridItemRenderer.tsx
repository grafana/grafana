import { css, cx } from '@emotion/css';

import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { ConditionalRendering } from '../../conditional-rendering/ConditionalRendering';
import { getDashboardSceneFor } from '../../utils/utils';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export function ResponsiveGridItemRenderer({ model }: SceneComponentProps<ResponsiveGridItem>) {
  const { body, $behaviors } = model.useState();
  const style = useStyles2(getStyles);
  const dashboard = getDashboardSceneFor(model);
  const { showHiddenElements } = dashboard.useState();

  const conditionalRendering = $behaviors?.find((behavior) => behavior instanceof ConditionalRendering);
  if (!(conditionalRendering?.evaluate() ?? true) && !showHiddenElements) {
    return null;
  }

  return (
    <div className={cx(style.wrapper)}>
      <body.Component model={body} />
    </div>
  );
}

function getStyles() {
  return {
    wrapper: css({
      width: '100%',
      height: '100%',
      position: 'relative',
    }),
  };
}
