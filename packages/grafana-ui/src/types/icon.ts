import { ComponentSize } from './size';
export type IconType = 'mono' | 'default';
export type IconSize = ComponentSize | 'xl' | 'xxl' | 'xxxl';

export type IconName =
  | 'angle-double-down'
  | 'angle-double-right'
  | 'angle-down'
  | 'angle-left'
  | 'angle-right'
  | 'angle-up'
  | 'apps'
  | 'arrow-down'
  | 'arrow-from-right'
  | 'arrow-left'
  | 'arrow-random'
  | 'arrow-right'
  | 'arrow-up'
  | 'arrow'
  | 'arrows-h'
  | 'bars'
  | 'bell-slash'
  | 'bell'
  | 'bolt'
  | 'book-open'
  | 'book'
  | 'brackets-curly'
  | 'bug'
  | 'calculator-alt'
  | 'calendar-alt'
  | 'camera'
  | 'channel-add'
  | 'chart-line'
  | 'check-circle'
  | 'check'
  | 'circle'
  | 'clipboard-alt'
  | 'clock-nine'
  | 'cloud-download'
  | 'cloud-upload'
  | 'cloud'
  | 'code-branch'
  | 'cog'
  | 'columns'
  | 'comment-alt'
  | 'comments-alt'
  | 'compass'
  | 'copy'
  | 'cube'
  | 'database'
  | 'document-info'
  | 'download-alt'
  | 'draggabledots'
  | 'edit'
  | 'ellipsis-v'
  | 'envelope'
  | 'exchange-alt'
  | 'exclamation-triangle'
  | 'exclamation'
  | 'external-link-alt'
  | 'eye-slash'
  | 'eye'
  | 'fa fa-spinner'
  | 'favorite'
  | 'file-alt'
  | 'file-blank'
  | 'file-copy-alt'
  | 'filter'
  | 'folder-open'
  | 'folder-plus'
  | 'folder-upload'
  | 'folder'
  | 'forward'
  | 'gf-interpolation-linear'
  | 'gf-interpolation-smooth'
  | 'gf-interpolation-step-after'
  | 'gf-interpolation-step-before'
  | 'gf-logs'
  | 'github'
  | 'gitlab'
  | 'grafana'
  | 'graph-bar'
  | 'google'
  | 'heart-break'
  | 'heart'
  | 'history'
  | 'home-alt'
  | 'import'
  | 'info-circle'
  | 'key-skeleton-alt'
  | 'keyboard'
  | 'line-alt'
  | 'link'
  | 'list-ul'
  | 'lock'
  | 'microsoft'
  | 'minus-circle'
  | 'minus'
  | 'mobile-android'
  | 'monitor'
  | 'okta'
  | 'palette'
  | 'panel-add'
  | 'pause'
  | 'pen'
  | 'percentage'
  | 'play'
  | 'plug'
  | 'plus-circle'
  | 'plus-square'
  | 'plus'
  | 'power'
  | 'question-circle'
  | 'repeat'
  | 'reusable-panel'
  | 'rocket'
  | 'save'
  | 'search-minus'
  | 'search-plus'
  | 'search'
  | 'share-alt'
  | 'shield'
  | 'shield-exclamation'
  | 'sign-in-alt'
  | 'signal'
  | 'signin'
  | 'signout'
  | 'slack'
  | 'sliders-v-alt'
  | 'sort-amount-down'
  | 'square-shape'
  | 'star'
  | 'step-backward'
  | 'sync'
  | 'table'
  | 'tag-alt'
  | 'times'
  | 'trash-alt'
  | 'unlock'
  | 'upload'
  | 'user'
  | 'users-alt'
  | 'wrap-text'
  | 'heart-rate'
  | 'x';

export const getAvailableIcons = (): IconName[] => [
  'angle-double-down',
  'angle-double-right',
  'angle-down',
  'angle-left',
  'angle-right',
  'angle-up',
  'apps',
  'arrow-down',
  'arrow-from-right',
  'arrow-left',
  'arrow-random',
  'arrow-right',
  'arrow-up',
  'arrow',
  'arrows-h',
  'bars',
  'bell-slash',
  'bell',
  'bolt',
  'book-open',
  'book',
  'brackets-curly',
  'bug',
  'calculator-alt',
  'calendar-alt',
  'camera',
  'channel-add',
  'chart-line',
  'check-circle',
  'check',
  'circle',
  'clipboard-alt',
  'clock-nine',
  'cloud-download',
  'cloud-upload',
  'cloud',
  'code-branch',
  'cog',
  'columns',
  'comment-alt',
  'comments-alt',
  'compass',
  'copy',
  'cube',
  'database',
  'document-info',
  'download-alt',
  'draggabledots',
  'edit',
  'ellipsis-v',
  'envelope',
  'exchange-alt',
  'exclamation-triangle',
  'external-link-alt',
  'eye-slash',
  'eye',
  'fa fa-spinner',
  'favorite',
  'file-alt',
  'file-blank',
  'file-copy-alt',
  'filter',
  'folder-open',
  'folder-plus',
  'folder-upload',
  'folder',
  'forward',
  'gf-interpolation-linear',
  'gf-interpolation-smooth',
  'gf-interpolation-step-after',
  'gf-interpolation-step-before',
  'gf-logs',
  'grafana',
  'graph-bar',
  'heart-break',
  'heart',
  'history',
  'home-alt',
  'import',
  'info-circle',
  'key-skeleton-alt',
  'keyboard',
  'line-alt',
  'link',
  'list-ul',
  'lock',
  'minus-circle',
  'minus',
  'mobile-android',
  'monitor',
  'palette',
  'panel-add',
  'pause',
  'pen',
  'percentage',
  'play',
  'plug',
  'plus-circle',
  'plus-square',
  'plus',
  'power',
  'question-circle',
  'repeat',
  'reusable-panel',
  'rocket',
  'save',
  'search-minus',
  'search-plus',
  'search',
  'share-alt',
  'shield',
  'shield-exclamation',
  'sign-in-alt',
  'signal',
  'signin',
  'signout',
  'slack',
  'sliders-v-alt',
  'sort-amount-down',
  'square-shape',
  'star',
  'step-backward',
  'sync',
  'table',
  'tag-alt',
  'times',
  'trash-alt',
  'unlock',
  'upload',
  'user',
  'users-alt',
  'wrap-text',
  'x',
];
