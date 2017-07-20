///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import $ from 'jquery';
import coreModule from 'app/core/core_module';
import Drop from 'tether-drop';
import twemoji from 'twemoji';
import emojiDef from './emoji_def';

const DEFAULT_ICON = '1f494'; // Broken heart
const TWEMOJI_BASE = '/public/vendor/npm/twemoji/2/';
const CP_SEPARATOR = emojiDef.CP_SEPARATOR; // Separator for double-sized codepoints like 1f1f7-1f1fa

/*
 * gfEmojiPicker directive
 * Additional directive for gfIconPicker. Provides emoji picker with filter by description.
 * Takes emoji from definition object:
 *   [
 *     {'name': 'smile', 'codepoint': '1f604', 'category': 'people'},
 *     ...
 *   ]
 * Uses twemoji (Twitter Emoji) library for converting Unicode emoji into SVG image.
 *
 * Example:
 * <gf-emoji-picker></gf-emoji-picker>
 */

let pickerTemplate = `
  <div class="gf-icon-picker">
    <div class="gf-form icon-filter">
      <input type="text" class="gf-form-input max-width-20" placeholder="Find icon by name"
        ng-model="iconFilter" ng-change="filterIcon()">
    </div>
    <ul class="nav nav-tabs" id="emojinav"></ul>
    <div class="icon-container">
      <div id="emoji-find-container"></div>
    </div>
  </div>
`;

let codePoints = emojiDef.codePoints;
let emojiDefs = emojiDef.emojiDef;

// Pre-build emoji images elements, grouped by categories.
// Building thousands of elements takes a time, so better to do it one time at application start.
let buildedImagesCategories = buildEmojiByCategories(emojiDefs);

coreModule.directive('gfEmojiPicker', function ($timeout, $compile) {
  function link(scope, elem, attrs) {
    scope.filterIcon = filterIcon;
    scope.categories = emojiDef.categories;
    scope.currentCategory = scope.categories[0];
    scope.prevCategory = scope.currentCategory;
    scope.icons = [];

    addCategories(elem);
    fillIcons(elem);

    // Convert pre-built image elements into DOM elements and push it into popover
    function fillIcons(elem) {
      let container = elem.find(".icon-container");
      _.each(buildedImagesCategories, (categoryElements, category) => {
        let categoryContainer = container.find(`#${category}`);

        _.each(categoryElements, (emojiElem, index) => {
          // When text elem converted into DOM, image is loading. To avoid double compilation and image loading,
          // replace text elem in buildedImagesCategories by real DOM elem after compilation.
          if (_.isString(emojiElem)) {
            emojiElem = $(emojiElem);
            buildedImagesCategories[category][index] = emojiElem;
          }

          emojiElem.on('click', onEmojiSelect);
          categoryContainer.append(emojiElem);
          scope.icons.push(emojiElem);
        });
      });
    }

    // Insert <div> container and nav tab for each emoji category
    function addCategories(elem) {
      let container = elem.find(".icon-container");
      let emojinav = elem.find("#emojinav");

      _.each(emojiDef.categories, category => {
        // Add tab to nav for each category
        let emoji_tab = emojinav.append($(`
          <li class="gf-tabs-item-emoji">
            <a href="#${category }" data-toggle="tab">${category}</a>
          </li>`
        ));

        let category_container = $(`
          <div id="${category}" ng-show="currentCategory === '${category}'"></div>
        `);
        // Compile new DOM elem to make ng-show worked
        $compile(category_container)(scope);
        container.append(category_container);
      });
      emojinav.find('li:first').addClass('active');

      // switch category by click on tab
      emojinav.on('show', e => {
        scope.$apply(() => {
          // use href attr (#name => name)
          setCategory(e.target.hash.slice(1));
        });
      });
    }

    function onEmojiSelect(event) {
      let codepoint = $(event.currentTarget).attr('codepoint');
      scope.onSelect(codepoint);
    }

    function filterIcon() {
      let container = elem.find(".icon-container");
      let findContainer = container.find('#emoji-find-container');
      if (scope.iconFilter.length === 0) {
        restoreCategory();
        findContainer.empty();
        return;
      } else {
        let icons = _.filter(scope.icons, icon => {
          let title = icon.attr("title");
          if (title) {
            return title.indexOf(scope.iconFilter) !== -1;
          } else {
            return false;
          }
        });

        setCategory(null);
        findContainer.empty();
        // clone elements to prevent them from moving and erasing.
        icons = _.map(icons, icon => icon.clone());
        findContainer.append(icons);
        // Attach event handlers to cloned elements
        findContainer.find('.gf-event-icon').on('click', onEmojiSelect);
      }
    }

    function setCategory(category) {
      if (category !== scope.currentCategory) {
        scope.prevCategory = scope.currentCategory;
        scope.currentCategory = category;
      }
    }

    function restoreCategory() {
      scope.currentCategory = scope.prevCategory;
    }
  }

  return {
    restrict: 'E',
    link: link,
    template: pickerTemplate
  };
});

// Convert all given emojis into HTML elements and group it by categories
function buildEmojiByCategories(emojiDefs) {
  let builded = {};

  _.each(emojiDef.categories, category => {
    builded[category] = [];
  });

  let emojiElem;
  _.each(emojiDefs, emoji => {
    try {
      emojiElem = buildEmojiElem(emoji.codepoint);
    } catch (error) {
      console.log(`Error while converting code point ${emoji.codepoint} ${emoji.name}`);
    }
    builded[emoji.category].push(emojiElem);
  });

  return builded;
}

// Convert code point into HTML element
// 1f1f7 => <img src=".../1f1f7.svg" ...>
function buildEmojiElem(codepoint) {
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

  return emoji;
}

// Build attrs for emoji HTML element
function attributesCallback(rawText, iconId) {
  let codepoint = twemoji.convert.toCodePoint(rawText);
  return {
    title: emojiDef.emojiMap[codepoint],
    codepoint: codepoint
  };
}

/*
 * gfIconPicker directive
 * Opens emoji picker by click on icon.
 * icon: HEX code point of emoji
 *
 * Example:
 * <gf-icon-picker icon="1f494"></gf-icon-picker>
 */

let buttonTemplate = `
  <span class="gf-form-input width-3">
    <a class="pointer gf-icon-picker-button" ng-click="ctrl.openEmojiPicker($event)">
      <i class="gf-event-icon fa fa-smile-o"></i>
    </a>
  </span>
`;

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

        let emoji = buildEmojiElem(codepoint);
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
      let emoji = buildEmojiElem(codepoint);
      elem.find('.gf-event-icon').replaceWith(emoji);
    }
  };
}

coreModule.directive('gfIconPicker', iconPicker);
