///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import twemoji from 'twemoji';
import emojiDef from './emoji/emoji_def';

let buttonTemplate = `
<span class="gf-form-input width-3">
  <a class="pointer" ng-click="ctrl.openEmojiPicker($event)">
    <i class="emoji fa fa-smile-o"></i>
  </a>
</span>
`;

let pickerTemplate = `
<div class="graph-legend-popover">
  <p class="m-b-0"></p>
</div>
`;

let codePoints = emojiDef.codePoints.slice(0, 200);

export class EmojiPickerCtrl {
  codePoints: string[];
  icons: any[];
  pickerTemplate: any;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private popoverSrv, private $timeout) {
    this.popoverSrv = popoverSrv;
    this.$timeout = $timeout;
    this.$scope = $scope;
  }

  emojiSelected(emoji) {
    console.log(emoji);
    this.$scope.$destroy();
  }
}

export class IconPickerCtrl {

  /** @ngInject */
  constructor(private $scope, private $rootScope, private popoverSrv, private $timeout) {
  }

  openEmojiPicker(e) {
    let el = $(e.currentTarget).find('.emoji');
    let onIconSelect = this.$scope.ctrl.onSelect;

    this.$timeout(() => {
      this.popoverSrv.show({
        element: el[0],
        position: 'bottom center',
        template: '<gf-emoji-picker></gf-emoji-picker>',
        openOn: 'hover',
        model: {
          onSelect: (codepoint) => {
            // Wrap into $apply() to sync changes immediately
            this.$scope.$apply(() => {
              this.$scope.ctrl.icon = codepoint;

              let emoji = buildEmoji(codepoint);
              el.replaceWith(emoji);

              this.popoverSrv.close();
            });
          }
        },
      });
    });
  }
}

coreModule.directive('gfEmojiPicker', function (popoverSrv, $timeout) {
  function link(scope, elem, attrs) {

    // Convert code points into emoji images and add it to popover
    _.each(codePoints, codepoint => {
      let emoji = buildEmoji(codepoint);

      emoji = $(emoji).css({
        padding: '0.2rem'
      });

      emoji.on('click', onEmojiSelect);

      elem.find(".m-b-0").append(emoji);
      return emoji;
    });

    function onEmojiSelect(event) {
      let codepoint = $(event.currentTarget).attr('codepoint');
      scope.onSelect(codepoint);
    }
  }

  return {
    restrict: 'E',
    link : link,
    controller: EmojiPickerCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
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

function buildEmoji(codepoint) {
  let utfCode = twemoji.convert.fromCodePoint(codepoint);
  let emoji = twemoji.parse(utfCode, {
    size: 16,
    attributes: attributesCallback,
    className: 'emoji'
  });
  return emoji;
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
      let defaultIcon = '1f494'; // Broken heart
      let codepoint = scope.ctrl.icon || defaultIcon;
      let emoji = buildEmoji(codepoint);
      elem.find('.emoji').replaceWith(emoji);
    }
  };
}

coreModule.directive('gfIconPicker', iconPicker);
