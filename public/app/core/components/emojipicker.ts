///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';
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

coreModule.directive('gfEmojiPicker', function ($timeout) {
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

function buildEmoji(codepoint) {
  let utfCode = twemoji.convert.fromCodePoint(codepoint);
  let emoji = twemoji.parse(utfCode, {
    size: 16,
    attributes: attributesCallback,
    className: 'emoji'
  });
  return emoji;
}

export class IconPickerCtrl {
  iconDrop: any;
  scope: any;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private $timeout, private $compile) {
    this.iconDrop = null;
  }

  openEmojiPicker(e) {
    let el = $(e.currentTarget).find('.emoji');
    let onIconSelect = this.$scope.ctrl.onSelect;

    this.$timeout(() => {
      let options = {
        element: el[0],
        position: 'bottom center',
        template: '<gf-emoji-picker></gf-emoji-picker>',
        openOn: 'hover',
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
        position: 'bottom center',
        classes: 'drop-popover',
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
      let defaultIcon = '1f494'; // Broken heart
      let codepoint = scope.ctrl.icon || defaultIcon;
      let emoji = buildEmoji(codepoint);
      elem.find('.emoji').replaceWith(emoji);
    }
  };
}

coreModule.directive('gfIconPicker', iconPicker);
