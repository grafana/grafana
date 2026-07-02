import { css } from '@emotion/css';

import { useStyles2 } from '../../../../themes/ThemeContext';

// Safari 26 shipped with a bug that prevents the table from rendering correctly
// unless it is wrapped in a container with `contain: strict`.
export function Safari26Wrapper(props: { children: React.ReactNode }) {
  const className = useStyles2(() => css({ contain: 'strict', height: '100%' }));
  return <div className={className}>{props.children}</div>;
}
