import { css } from '@emotion/css';

import { IconName } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { Icon } from '../Icon/Icon';
import { getSvgSize } from '../Icon/utils';

type MenuItemPrefixProps = {
  prefix?: React.ReactElement;
  icon?: IconName;
};

/** @internal */
export function MenuItemPrefix({ prefix, icon }: MenuItemPrefixProps): React.ReactNode {
  const styles = useStyles2(getStyles);

  if (!icon && !prefix) {
    return null;
  }

  if (icon) {
    return <Icon name={icon} className={styles.icon} aria-hidden />;
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
