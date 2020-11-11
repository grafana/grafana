import React from 'react';
import { ComponentSize } from './size';

// Exports of main Icon types
export type IconProps = SolidIconProps | DefaultIconProps;
export type IconType = DefaultIconType | SolidIconType;
export type IconName = DefaultIconName | SolidIconName;
export type IconSize = ComponentSize | 'xl' | 'xxl' | 'xxxl';

// Default types
export interface DefaultIconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: DefaultIconName;
  type?: DefaultIconType;
  size?: IconSize;
}

type DefaultIconType = 'default';
type DefaultIconName =
  | 'fa fa-spinner'
  | 'heart'
  | 'grafana'
  | 'question-circle'
  | 'angle-up'
  | 'history'
  | 'angle-down'
  | 'filter'
  | 'angle-left'
  | 'angle-right'
  | 'angle-double-right'
  | 'angle-double-down'
  | 'pen'
  | 'envelope'
  | 'percentage'
  | 'rocket'
  | 'power'
  | 'trash-alt'
  | 'slack'
  | 'download-alt'
  | 'mobile-android'
  | 'plus-square'
  | 'folder-plus'
  | 'folder-open'
  | 'folder'
  | 'file-copy-alt'
  | 'file-alt'
  | 'exchange-alt'
  | 'import'
  | 'exclamation-triangle'
  | 'times'
  | 'signin'
  | 'cloud-upload'
  | 'step-backward'
  | 'square-shape'
  | 'share-alt'
  | 'tag-alt'
  | 'forward'
  | 'check'
  | 'check-circle'
  | 'copy'
  | 'lock'
  | 'unlock'
  | 'panel-add'
  | 'arrow-random'
  | 'arrow-down'
  | 'arrows-h'
  | 'comment-alt'
  | 'code-branch'
  | 'arrow-right'
  | 'circle'
  | 'arrow-up'
  | 'arrow-from-right'
  | 'keyboard'
  | 'search'
  | 'chart-line'
  | 'search-minus'
  | 'clock-nine'
  | 'sync'
  | 'sign-in-alt'
  | 'cloud-download'
  | 'cog'
  | 'bars'
  | 'save'
  | 'apps'
  | 'link'
  | 'upload'
  | 'columns'
  | 'home-alt'
  | 'channel-add'
  | 'calendar-alt'
  | 'play'
  | 'pause'
  | 'calculator-alt'
  | 'compass'
  | 'sliders-v-alt'
  | 'bell'
  | 'database'
  | 'user'
  | 'camera'
  | 'plug'
  | 'shield'
  | 'key-skeleton-alt'
  | 'users-alt'
  | 'graph-bar'
  | 'book'
  | 'bolt'
  | 'comments-alt'
  | 'document-info'
  | 'info-circle'
  | 'bug'
  | 'cube'
  | 'star'
  | 'list-ul'
  | 'edit'
  | 'eye'
  | 'eye-slash'
  | 'monitor'
  | 'plus-circle'
  | 'arrow-left'
  | 'repeat'
  | 'external-link-alt'
  | 'minus'
  | 'signal'
  | 'search-plus'
  | 'minus-circle'
  | 'table'
  | 'plus'
  | 'heart-break'
  | 'ellipsis-v'
  | 'favorite'
  | 'line-alt'
  | 'sort-amount-down'
  | 'cloud'
  | 'draggabledots'
  | 'folder-upload';

// Solid/mono types
export interface SolidIconProps extends React.HTMLAttributes<HTMLDivElement> {
  name: SolidIconName;
  type: SolidIconType;
  size?: IconSize;
}

type SolidIconType = 'solid';
type SolidIconName =
  | 'apps'
  | 'bell'
  | 'circle'
  | 'cog'
  | 'favorite'
  | 'folder'
  | 'folder-plus'
  | 'grafana'
  | 'heart'
  | 'heart-break'
  | 'import'
  | 'panel-add'
  | 'plus-square'
  | 'shield'
  | 'square-shape';

export const getAvailableDefaultIcons = (): DefaultIconName[] => [
  'fa fa-spinner',
  'question-circle',
  'angle-up',
  'history',
  'angle-down',
  'filter',
  'angle-left',
  'angle-right',
  'angle-double-right',
  'angle-double-down',
  'pen',
  'envelope',
  'percentage',
  'rocket',
  'power',
  'trash-alt',
  'slack',
  'download-alt',
  'mobile-android',
  'plus-square',
  'folder-plus',
  'folder-open',
  'folder',
  'file-copy-alt',
  'file-alt',
  'exchange-alt',
  'import',
  'exclamation-triangle',
  'times',
  'signin',
  'cloud-upload',
  'step-backward',
  'square-shape',
  'share-alt',
  'tag-alt',
  'forward',
  'check',
  'check-circle',
  'copy',
  'lock',
  'unlock',
  'panel-add',
  'arrow-random',
  'arrow-down',
  'arrows-h',
  'comment-alt',
  'code-branch',
  'arrow-right',
  'circle',
  'arrow-up',
  'arrow-from-right',
  'keyboard',
  'search',
  'chart-line',
  'search-minus',
  'clock-nine',
  'sync',
  'sign-in-alt',
  'cloud-download',
  'cog',
  'bars',
  'save',
  'apps',
  'link',
  'upload',
  'columns',
  'home-alt',
  'channel-add',
  'calendar-alt',
  'play',
  'pause',
  'calculator-alt',
  'compass',
  'sliders-v-alt',
  'bell',
  'database',
  'user',
  'camera',
  'plug',
  'shield',
  'key-skeleton-alt',
  'users-alt',
  'graph-bar',
  'book',
  'bolt',
  'comments-alt',
  'document-info',
  'info-circle',
  'bug',
  'cube',
  'star',
  'list-ul',
  'edit',
  'eye',
  'eye-slash',
  'monitor',
  'plus-circle',
  'arrow-left',
  'repeat',
  'external-link-alt',
  'minus',
  'signal',
  'search-plus',
  'minus-circle',
  'table',
  'plus',
  'heart-break',
  'ellipsis-v',
  'favorite',
  'sort-amount-down',
  'cloud',
  'draggabledots',
  'folder-upload',
];

export const getAvailableSolidIcons = (): SolidIconName[] => [
  'apps',
  'bell',
  'circle',
  'cog',
  'favorite',
  'folder',
  'folder-plus',
  'grafana',
  'heart',
  'heart-break',
  'import',
  'panel-add',
  'plus-square',
  'shield',
  'square-shape',
];
