import React from 'react';
import { css, cx } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { stylesFactory } from '../../themes/stylesFactory';
import { useTheme } from '../../themes/ThemeContext';
import { IconName, IconType, IconSize } from '../../types/icon';
import SVG, { cacheStore } from '@leeoniya/react-inlinesvg';

// inlined static cache

import i001 from '!!raw-loader!../../../../../public/img/icons/unicons/bars.svg';
import i002 from '!!raw-loader!../../../../../public/img/icons/unicons/times.svg';
import i003 from '!!raw-loader!../../../../../public/img/icons/unicons/search.svg';
import i004 from '!!raw-loader!../../../../../public/img/icons/unicons/plus.svg';
import i005 from '!!raw-loader!../../../../../public/img/icons/unicons/apps.svg';
import i006 from '!!raw-loader!../../../../../public/img/icons/unicons/folder-plus.svg';
import i007 from '!!raw-loader!../../../../../public/img/icons/unicons/import.svg';
import i008 from '!!raw-loader!../../../../../public/img/icons/unicons/home-alt.svg';
import i009 from '!!raw-loader!../../../../../public/img/icons/unicons/sitemap.svg';
import i010 from '!!raw-loader!../../../../../public/img/icons/unicons/presentation-play.svg';
import i011 from '!!raw-loader!../../../../../public/img/icons/unicons/camera.svg';
import i012 from '!!raw-loader!../../../../../public/img/icons/unicons/compass.svg';
import i013 from '!!raw-loader!../../../../../public/img/icons/unicons/bell.svg';
import i014 from '!!raw-loader!../../../../../public/img/icons/unicons/list-ul.svg';
import i015 from '!!raw-loader!../../../../../public/img/icons/unicons/comment-alt-share.svg';
import i016 from '!!raw-loader!../../../../../public/img/icons/unicons/cog.svg';
import i017 from '!!raw-loader!../../../../../public/img/icons/unicons/database.svg';
import i018 from '!!raw-loader!../../../../../public/img/icons/unicons/user.svg';
import i019 from '!!raw-loader!../../../../../public/img/icons/unicons/users-alt.svg';
import i020 from '!!raw-loader!../../../../../public/img/icons/unicons/plug.svg';
import i021 from '!!raw-loader!../../../../../public/img/icons/unicons/sliders-v-alt.svg';
import i022 from '!!raw-loader!../../../../../public/img/icons/unicons/key-skeleton-alt.svg';
import i023 from '!!raw-loader!../../../../../public/img/icons/unicons/shield.svg';
import i024 from '!!raw-loader!../../../../../public/img/icons/unicons/building.svg';
import i025 from '!!raw-loader!../../../../../public/img/icons/unicons/graph-bar.svg';
import i026 from '!!raw-loader!../../../../../public/img/icons/unicons/unlock.svg';
import i027 from '!!raw-loader!../../../../../public/img/icons/unicons/lock.svg';
import i028 from '!!raw-loader!../../../../../public/img/icons/unicons/arrow-from-right.svg';
import i029 from '!!raw-loader!../../../../../public/img/icons/unicons/question-circle.svg';
import i030 from '!!raw-loader!../../../../../public/img/icons/unicons/document-info.svg';
import i031 from '!!raw-loader!../../../../../public/img/icons/unicons/comments-alt.svg';
import i032 from '!!raw-loader!../../../../../public/img/icons/unicons/keyboard.svg';
import i033 from '!!raw-loader!../../../../../public/img/icons/unicons/star.svg';
import i034 from '!!raw-loader!../../../../../public/img/icons/unicons/share-alt.svg';
import i035 from '!!raw-loader!../../../../../public/img/icons/mono/panel-add.svg';
import i036 from '!!raw-loader!../../../../../public/img/icons/unicons/save.svg';
import i037 from '!!raw-loader!../../../../../public/img/icons/unicons/clock-nine.svg';
import i038 from '!!raw-loader!../../../../../public/img/icons/unicons/angle-down.svg';
import i039 from '!!raw-loader!../../../../../public/img/icons/unicons/search-minus.svg';
import i040 from '!!raw-loader!../../../../../public/img/icons/unicons/sync.svg';
import i041 from '!!raw-loader!../../../../../public/img/icons/unicons/monitor.svg';
import i042 from '!!raw-loader!../../../../../public/img/icons/unicons/trash-alt.svg';

function cacheItem(content: string, path: string) {
  cacheStore[path] = { content, status: 'loaded', queue: [] };
}

cacheItem(i001, '/public/img/icons/unicons/bars.svg');
cacheItem(i002, '/public/img/icons/unicons/times.svg');
cacheItem(i003, '/public/img/icons/unicons/search.svg');
cacheItem(i004, '/public/img/icons/unicons/plus.svg');
cacheItem(i005, '/public/img/icons/unicons/apps.svg');
cacheItem(i006, '/public/img/icons/unicons/folder-plus.svg');
cacheItem(i007, '/public/img/icons/unicons/import.svg');
cacheItem(i008, '/public/img/icons/unicons/home-alt.svg');
cacheItem(i009, '/public/img/icons/unicons/sitemap.svg');
cacheItem(i010, '/public/img/icons/unicons/presentation-play.svg');
cacheItem(i011, '/public/img/icons/unicons/camera.svg');
cacheItem(i012, '/public/img/icons/unicons/compass.svg');
cacheItem(i013, '/public/img/icons/unicons/bell.svg');
cacheItem(i014, '/public/img/icons/unicons/list-ul.svg');
cacheItem(i015, '/public/img/icons/unicons/comment-alt-share.svg');
cacheItem(i016, '/public/img/icons/unicons/cog.svg');
cacheItem(i017, '/public/img/icons/unicons/database.svg');
cacheItem(i018, '/public/img/icons/unicons/user.svg');
cacheItem(i019, '/public/img/icons/unicons/users-alt.svg');
cacheItem(i020, '/public/img/icons/unicons/plug.svg');
cacheItem(i021, '/public/img/icons/unicons/sliders-v-alt.svg');
cacheItem(i022, '/public/img/icons/unicons/key-skeleton-alt.svg');
cacheItem(i023, '/public/img/icons/unicons/shield.svg');
cacheItem(i024, '/public/img/icons/unicons/building.svg');
cacheItem(i025, '/public/img/icons/unicons/graph-bar.svg');
cacheItem(i026, '/public/img/icons/unicons/unlock.svg');
cacheItem(i027, '/public/img/icons/unicons/lock.svg');
cacheItem(i028, '/public/img/icons/unicons/arrow-from-right.svg');
cacheItem(i029, '/public/img/icons/unicons/question-circle.svg');
cacheItem(i030, '/public/img/icons/unicons/document-info.svg');
cacheItem(i031, '/public/img/icons/unicons/comments-alt.svg');
cacheItem(i032, '/public/img/icons/unicons/keyboard.svg');
cacheItem(i033, '/public/img/icons/unicons/star.svg');
cacheItem(i034, '/public/img/icons/unicons/share-alt.svg');
cacheItem(i035, '/public/img/icons/mono/panel-add.svg');
cacheItem(i036, '/public/img/icons/unicons/save.svg');
cacheItem(i037, '/public/img/icons/unicons/clock-nine.svg');
cacheItem(i038, '/public/img/icons/unicons/angle-down.svg');
cacheItem(i039, '/public/img/icons/unicons/search-minus.svg');
cacheItem(i040, '/public/img/icons/unicons/sync.svg');
cacheItem(i041, '/public/img/icons/unicons/monitor.svg');
cacheItem(i042, '/public/img/icons/unicons/trash-alt.svg');

const alwaysMonoIcons: IconName[] = ['grafana', 'favorite', 'heart-break', 'heart', 'panel-add', 'reusable-panel'];

export interface IconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: IconName;
  size?: IconSize;
  type?: IconType;
}

const getIconStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    container: css`
      label: Icon;
      display: inline-block;
    `,
    icon: css`
      vertical-align: middle;
      display: inline-block;
      margin-bottom: ${theme.spacing.xxs};
      fill: currentColor;
    `,
    orange: css`
      fill: ${theme.palette.orange};
    `,
  };
});

function getIconSubDir(name: IconName, type: string): string {
  return name?.startsWith('gf-')
    ? 'custom'
    : alwaysMonoIcons.includes(name)
    ? 'mono'
    : type === 'default'
    ? 'unicons'
    : 'mono';
}

export const Icon = React.forwardRef<HTMLDivElement, IconProps>(
  ({ size = 'md', type = 'default', name, className, style, ...divElementProps }, ref) => {
    const theme = useTheme();

    /* Temporary solution to display also font awesome icons */
    if (name?.startsWith('fa fa-')) {
      return <i className={getFontAwesomeIconStyles(name, className)} {...divElementProps} style={style} />;
    }

    if (name === 'panel-add') {
      size = 'xl';
    }

    const styles = getIconStyles(theme);
    const svgSize = getSvgSize(size);
    const svgHgt = svgSize;
    const svgWid = name?.startsWith('gf-bar-align') ? 16 : name?.startsWith('gf-interp') ? 30 : svgSize;
    const subDir = getIconSubDir(name, type);
    const svgPath = `/public/img/icons/${subDir}/${name}.svg`;

    return (
      <div className={styles.container} {...divElementProps} ref={ref}>
        <SVG
          src={svgPath}
          width={svgWid}
          height={svgHgt}
          className={cx(styles.icon, className, type === 'mono' ? { [styles.orange]: name === 'favorite' } : '')}
          style={style}
        />
      </div>
    );
  }
);

Icon.displayName = 'Icon';

function getFontAwesomeIconStyles(iconName: string, className?: string): string {
  return cx(
    iconName,
    {
      'fa-spin': iconName === 'fa fa-spinner',
    },
    className
  );
}

/* Transform string with px to number and add 2 pxs as path in svg is 2px smaller */
export const getSvgSize = (size: IconSize) => {
  switch (size) {
    case 'xs':
      return 12;
    case 'sm':
      return 14;
    case 'md':
      return 16;
    case 'lg':
      return 18;
    case 'xl':
      return 24;
    case 'xxl':
      return 36;
    case 'xxxl':
      return 48;
  }
};
