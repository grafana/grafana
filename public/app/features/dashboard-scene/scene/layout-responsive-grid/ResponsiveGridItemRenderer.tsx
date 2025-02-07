import { css, cx } from '@emotion/css';

import { SceneComponentProps } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

import { ResponsiveGridItem } from './ResponsiveGridItem';

export function ResponsiveGridItemRenderer({ model }: SceneComponentProps<ResponsiveGridItem>) {
  const { body } = model.useState();
  const style = useStyles2(getStyles);

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
