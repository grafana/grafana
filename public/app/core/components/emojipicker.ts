///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';
import twemoji from 'twemoji';
import emojiDef from './emoji/emoji_def';

const DEFAULT_ICON = '1f494'; // Broken heart
const TWEMOJI_BASE = '/public/vendor/npm/twemoji/2/';
const CP_SEPARATOR = emojiDef.CP_SEPARATOR;

let buttonTemplate = `
<span class="gf-form-input width-3">
  <a class="pointer gf-icon-picker-button" ng-click="ctrl.openEmojiPicker($event)">
    <i class="gf-event-icon fa fa-smile-o"></i>
  </a>
</span>
`;

let pickerTemplate = `
<div class="gf-icon-picker">
  <div class="gf-form icon-filter">
    <input type="text"
      ng-model="iconFilter" ng-change="filterIcon()"
      class="gf-form-input max-width-20" placeholder="Find icon by name">
  </div>
  <div class="icon-container"></div>
</div>
`;

let codePoints = emojiDef.codePoints;

coreModule.directive('gfEmojiPicker', function ($timeout) {
  function link(scope, elem, attrs) {
    scope.filterIcon = filterIcon;
    scope.icons = [];

    addIcons(elem, codePoints);

    // Convert code points into emoji images and add it to popover
    function addIcons(elem, codePoints) {
      _.each(codePoints, codepoint => {
        let emoji;
        try {
          emoji = buildEmoji(codepoint);
        } catch (error) {
          console.log("Error while converting code point", codepoint);
        }

        scope.icons.push(emoji);
        return emoji;
      });
      let container = elem.find(".icon-container");
      container.append(scope.icons);
      container.find('.gf-event-icon').on('click', onEmojiSelect);
    }

    function onEmojiSelect(event) {
      let codepoint = $(event.currentTarget).attr('codepoint');
      scope.onSelect(codepoint);
    }

    function filterIcon() {
      let icons = _.filter(scope.icons, icon => {
        let title = icon.attr("title");
        if (title) {
          return title.indexOf(scope.iconFilter) !== -1;
        } else {
          return false;
        }
      });

      let container = elem.find(".icon-container");
      container.empty();
      container.append(icons);
      container.find('.gf-event-icon').on('click', onEmojiSelect);
    }
  }

  return {
    restrict: 'E',
    link: link,
    template: pickerTemplate
  };
});

function attributesCallback(rawText, iconId) {
  let codepoint = twemoji.convert.toCodePoint(rawText);
  return {
    title: emojiDef.emojiMap[codepoint],
    codepoint: codepoint
  };
}

function buildEmoji(codepoint, size?) {
  let utfCode;

  // handle double-sized codepoints like 1f1f7-1f1fa
  if (codepoint.indexOf(CP_SEPARATOR) !== -1) {
    let codepoints = codepoint.split(CP_SEPARATOR);
    utfCode = _.map(codepoints, twemoji.convert.fromCodePoint).join('');
  } else {
    utfCode = twemoji.convert.fromCodePoint(codepoint);
  }

  let emoji = twemoji.parse(utfCode, {
    base: TWEMOJI_BASE,
    folder: 'svg',
    ext: '.svg',
    attributes: attributesCallback,
    className: 'emoji gf-event-icon'
  });

  emoji = $(emoji);
  if (size) {
    emoji = $(emoji).css({
      height: size
    });
  }
  return emoji;
}

export class IconPickerCtrl {
  iconDrop: any;
  scope: any;
  icon: string;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private $timeout, private $compile) {
    this.icon = this.icon || DEFAULT_ICON;
    this.iconDrop = null;
  }

  openEmojiPicker(e) {
    let el = $(e.currentTarget).find('.gf-event-icon');
    let onIconSelect = this.$scope.ctrl.onSelect;

    this.$timeout(() => {
      let options = {
        template: '<gf-emoji-picker></gf-emoji-picker>',
        model: {
          onSelect: onSelect.bind(this)
        },
      };

      this.scope = _.extend(this.$rootScope.$new(true), options.model);
      var contentElement = document.createElement('div');
      contentElement.innerHTML = options.template;
      this.$compile(contentElement)(this.scope);

      let drop = new Drop({
        target: el[0],
        content: contentElement,
        position: 'top center',
        classes: 'drop-popover drop-popover--form',
        openOn: 'hover',
        hoverCloseDelay: 200,
        tetherOptions: {
          constraints: [{ to: 'scrollParent', attachment: "none both" }]
        }
      });

      drop.on('close', this.close.bind(this));

      this.iconDrop = drop;
      this.iconDrop.open();
    });

    function onSelect(codepoint) {
      // Wrap into $apply() to sync changes immediately
      this.$scope.$apply(() => {
        this.$scope.ctrl.icon = codepoint;

        let emoji = buildEmoji(codepoint);
        el.replaceWith(emoji);

        this.iconDrop.close();
      });
    }
  }

  close() {
    this.$timeout(() => {
      this.scope.$destroy();

      if (this.iconDrop.tether) {
        this.iconDrop.destroy();
      }
    });
  }
}

export function iconPicker() {
  return {
    restrict: 'E',
    controller: IconPickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    template: buttonTemplate,
    scope: {
      icon: "="
    },
    link: function (scope, elem, attrs)  {
      let codepoint = scope.ctrl.icon || DEFAULT_ICON;
      let emoji = buildEmoji(codepoint);
      elem.find('.gf-event-icon').replaceWith(emoji);
    }
  };
}

coreModule.directive('gfIconPicker', iconPicker);
