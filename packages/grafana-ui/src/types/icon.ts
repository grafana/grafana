import { ComponentSize } from './size';
export type IconType = 'mono' | 'default';
export type IconSize = ComponentSize | 'xl' | 'xxl';

export type IconName =
  | 'fa fa-fw fa-unlock'
  | 'fa fa-envelope'
  | 'fa fa-spinner'
  | 'question-circle'
  | 'angle-up'
  | 'history'
  | 'angle-down'
  | 'filter'
  | 'angle-left'
  | 'angle-right'
  | 'pen'
  | 'plane'
  | 'power'
  | 'trash-alt'
  | 'plus-square'
  | 'folder-plus'
  | 'folder-open'
  | 'file-copy-alt'
  | 'exchange-alt'
  | 'import'
  | 'exclamation-triangle'
  | 'times'
  | 'cloud-upload'
  | 'step-backward'
  | 'square-shape'
  | 'share-alt'
  | 'tag-alt'
  | 'forward'
  | 'check'
  | 'add-panel'
  | 'copy'
  | 'lock'
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
  | 'signin'
  | 'cog'
  | 'bars'
  | 'save'
  | 'apps'
  | 'folder-plus'
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
  | 'shield'
  | 'eye'
  | 'eye-slash'
  | 'filter'
  | 'monitor'
  | 'plus-circle'
  | 'arrow-left'
  | 'repeat'
  | 'external-link-alt'
  | 'minus'
  | 'signal'
  | 'search-plus'
  | 'search-minus'
  | 'minus-circle'
  | 'table'
  | 'plus'
  | 'heart'
  | 'heartbeat'
  | 'ellipsis-v'
  | 'favorite';

export const getAvailableIcons = (): IconName[] => [
  'question-circle',
  'plane',
  'plus',
  'plus-circle',
  'angle-up',
  'shield',
  'angle-down',
  'angle-left',
  'angle-right',
  'calendar-alt',
  'tag-alt',
  'calculator-alt',
  'pen',
  'repeat',
  'external-link-alt',
  'power',
  'play',
  'pause',
  'trash-alt',
  'exclamation-triangle',
  'times',
  'step-backward',
  'square-shape',
  'share-alt',
  'camera',
  'forward',
  'check',
  'add-panel',
  'copy',
  'lock',
  'panel-add',
  'arrow-random',
  'arrow-from-right',
  'arrow-left',
  'keyboard',
  'search',
  'chart-line',
  'search-minus',
  'clock-nine',
  'sync',
  'signin',
  'cog',
  'bars',
  'save',
  'apps',
  'folder-plus',
  'link',
  'upload',
  'home-alt',
  'compass',
  'sliders-v-alt',
  'bell',
  'database',
  'user',
  'plug',
  'shield',
  'key-skeleton-alt',
  'users-alt',
  'graph-bar',
  'book',
  'bolt',
  'cloud-upload',
  'comments-alt',
  'list-ul',
  'document-info',
  'info-circle',
  'bug',
  'cube',
  'history',
  'star',
  'edit',
  'columns',
  'eye',
  'channel-add',
  'monitor',
  'favorite',
  'folder-plus',
  'plus-square',
  'import',
  'folder-open',
  'file-copy-alt',
  'arrow-down',
  'filter',
  'arrow-up',
  'exchange-alt',
];
