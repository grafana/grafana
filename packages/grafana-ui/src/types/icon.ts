import { Field, FieldType } from '@grafana/data';

import { ComponentSize } from './size';

export type IconType = 'mono' | 'default' | 'solid';
export type IconSize = ComponentSize | 'xl' | 'xxl' | 'xxxl';

const avaibleBrandIcons = [
  'google' as const,
  'microsoft' as const,
  'github' as const,
  'gitlab' as const,
  'okta' as const,
];

const availableIcons = [
  'anchor' as const,
  'angle-double-down' as const,
  'angle-double-right' as const,
  'angle-double-up' as const,
  'angle-down' as const,
  'angle-left' as const,
  'angle-right' as const,
  'angle-up' as const,
  'apps' as const,
  'arrow' as const,
  'arrow-down' as const,
  'arrow-from-right' as const,
  'arrow-left' as const,
  'arrow-random' as const,
  'arrow-right' as const,
  'arrow-up' as const,
  'arrows-h' as const,
  'arrows-v' as const,
  'backward' as const,
  'bars' as const,
  'bell' as const,
  'bell-slash' as const,
  'bolt' as const,
  'book' as const,
  'bookmark' as const,
  'book-open' as const,
  'brackets-curly' as const,
  'building' as const,
  'bug' as const,
  'building' as const,
  'calculator-alt' as const,
  'calendar-alt' as const,
  'camera' as const,
  'capture' as const,
  'channel-add' as const,
  'chart-line' as const,
  'check' as const,
  'check-circle' as const,
  'circle' as const,
  'clipboard-alt' as const,
  'clock-nine' as const,
  'cloud' as const,
  'cloud-download' as const,
  'cloud-upload' as const,
  'code-branch' as const,
  'cog' as const,
  'columns' as const,
  'comment-alt' as const,
  'comment-alt-message' as const,
  'comment-alt-share' as const,
  'comments-alt' as const,
  'compass' as const,
  'copy' as const,
  'credit-card' as const,
  'cube' as const,
  'dashboard' as const,
  'database' as const,
  'document-info' as const,
  'download-alt' as const,
  'draggabledots' as const,
  'edit' as const,
  'ellipsis-v' as const,
  'envelope' as const,
  'exchange-alt' as const,
  'exclamation-triangle' as const,
  'exclamation-circle' as const,
  'external-link-alt' as const,
  'eye' as const,
  'eye-slash' as const,
  'ellipsis-h' as const,
  'fa fa-spinner' as const,
  'favorite' as const,
  'file-alt' as const,
  'file-blank' as const,
  'file-copy-alt' as const,
  'filter' as const,
  'folder' as const,
  'font' as const,
  'fire' as const,
  'folder-open' as const,
  'folder-plus' as const,
  'folder-upload' as const,
  'forward' as const,
  'gf-bar-alignment-after' as const,
  'gf-bar-alignment-before' as const,
  'gf-bar-alignment-center' as const,
  'gf-glue' as const,
  'gf-grid' as const,
  'gf-interpolation-linear' as const,
  'gf-interpolation-smooth' as const,
  'gf-interpolation-step-after' as const,
  'gf-interpolation-step-before' as const,
  'gf-landscape' as const,
  'gf-layout-simple' as const,
  'gf-logs' as const,
  'gf-portrait' as const,
  'grafana' as const,
  'graph-bar' as const,
  'heart' as const,
  'heart-break' as const,
  'history' as const,
  'home' as const,
  'home-alt' as const,
  'horizontal-align-center' as const,
  'horizontal-align-left' as const,
  'horizontal-align-right' as const,
  'hourglass' as const,
  'import' as const,
  'info' as const,
  'info-circle' as const,
  'key-skeleton-alt' as const,
  'keyboard' as const,
  'layer-group' as const,
  'library-panel' as const,
  'line-alt' as const,
  'link' as const,
  'list-ui-alt' as const,
  'list-ul' as const,
  'lock' as const,
  'map-marker' as const,
  'message' as const,
  'minus' as const,
  'minus-circle' as const,
  'mobile-android' as const,
  'monitor' as const,
  'palette' as const,
  'panel-add' as const,
  'pause' as const,
  'pen' as const,
  'percentage' as const,
  'play' as const,
  'plug' as const,
  'plus' as const,
  'plus-circle' as const,
  'plus-square' as const,
  'power' as const,
  'presentation-play' as const,
  'process' as const,
  'question-circle' as const,
  'record-audio' as const,
  'repeat' as const,
  'rocket' as const,
  'ruler-combined' as const,
  'save' as const,
  'search' as const,
  'search-minus' as const,
  'search-plus' as const,
  'share-alt' as const,
  'shield' as const,
  'shield-exclamation' as const,
  'signal' as const,
  'signin' as const,
  'signout' as const,
  'sitemap' as const,
  'slack' as const,
  'sliders-v-alt' as const,
  'sort-amount-down' as const,
  'sort-amount-up' as const,
  'square-shape' as const,
  'star' as const,
  'step-backward' as const,
  'stopwatch-slash' as const,
  'sync' as const,
  'table' as const,
  'tag-alt' as const,
  'text-fields' as const,
  'times' as const,
  'toggle-on' as const,
  'trash-alt' as const,
  'unlock' as const,
  'upload' as const,
  'user' as const,
  'users-alt' as const,
  'vertical-align-bottom' as const,
  'vertical-align-center' as const,
  'vertical-align-top' as const,
  'wrap-text' as const,
  'rss' as const,
  'x' as const,
];

// function remains for backwards compatibility
export const getAvailableIcons = () => availableIcons;

type BrandIconNames = typeof avaibleBrandIcons;

export type IconName = ReturnType<typeof getAvailableIcons>[number] | BrandIconNames[number];

/** Get the icon for a given field type */
export function getFieldTypeIcon(field?: Field): IconName {
  if (field) {
    switch (field.type) {
      case FieldType.time:
        return 'clock-nine';
      case FieldType.string:
        return 'font';
      case FieldType.number:
        return 'calculator-alt';
      case FieldType.boolean:
        return 'toggle-on';
      case FieldType.trace:
        return 'info-circle';
      case FieldType.geo:
        return 'map-marker';
      case FieldType.other:
        return 'brackets-curly';
    }
  }
  return 'question-circle';
}

function isValidIconName(iconName: string): iconName is IconName {
  const namedIcons: string[] = availableIcons;
  const brandIcons: string[] = avaibleBrandIcons;

  return namedIcons.includes(iconName) || brandIcons.includes(iconName);
}

export function toIconName(iconName: string): IconName | undefined {
  if (isValidIconName(iconName)) {
    return iconName;
  }

  return undefined;
}
