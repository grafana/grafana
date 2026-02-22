import { css } from '@emotion/css';
import { isValidElement } from 'react';

import { IconName, isIconName } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { getSvgSize } from '../Icon/utils';

type MenuItemPrefixProps = {
  prefix?: React.ReactElement | IconName;
};

/** @internal */
export function MenuItemPrefix({ prefix }: MenuItemPrefixProps): React.ReactNode {
  const styles = useStyles2(getStyles);

  if (!prefix) {
    return null;
  }

  if (isIconName(prefix)) {
    return <Icon name={prefix} className={styles.icon} aria-hidden />;
  }

  if (!isValidElement(prefix)) {
    return null;
  }

  return (
    <div className={styles.prefix} aria-hidden>
      {prefix}
    </div>
  );
}

function getStyles() {
  const prefixSize = getSvgSize('md');

  return {
    icon: css({
      opacity: 0.7,
    }),
    prefix: css({
      display: 'inline-block',
      verticalAlign: 'middle',
      width: prefixSize,
      height: prefixSize,
      overflow: 'hidden',
    }),
  };
}
