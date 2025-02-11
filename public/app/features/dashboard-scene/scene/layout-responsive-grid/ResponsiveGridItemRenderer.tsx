import { css, cx } from '@emotion/css';

import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { useDashboardState, useIsConditionallyHidden } from '../../utils/utils';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export function ResponsiveGridItemRenderer({ model }: SceneComponentProps<ResponsiveGridItem>) {
  const { body } = model.useState();
  const style = useStyles2(getStyles);
  const { showHiddenElements } = useDashboardState(model);
  const isConditionallyHidden = useIsConditionallyHidden(model);

  if (isConditionallyHidden && !showHiddenElements) {
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
