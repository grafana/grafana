///<reference path="../../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import coreModule from '../../core_module';

function typeaheadMatcher(item) {
  var str = this.query;
  if (str[0] === '/') { str = str.substring(1); }
  if (str[str.length - 1] === '/') { str = str.substring(0, str.length-1); }
  return item.toLowerCase().match(str.toLowerCase());
}

export class FormDropdownCtrl {
  inputElement: any;
  linkElement: any;
  value: any;
  text: any;
  display: any;
  options: any;
  cssClass: any;
  allowCustom: any;
  linkMode: boolean;
  cancelBlur: any;
  onChange: any;

  constructor(private $scope, $element, private $sce, private templateSrv) {
    this.inputElement = $element.find('input').first();
    this.linkElement = $element.find('a').first();
    this.linkMode = true;
    this.cancelBlur = null;

    if (this.options) {
      var item = _.find(this.options, {value: this.value});
      this.updateDisplay(item ? item.text : this.value);
    }

    this.inputElement.attr('data-provide', 'typeahead');
    this.inputElement.typeahead({
      source: this.typeaheadSource.bind(this),
      minLength: 0,
      items: 10000,
      updater: this.typeaheadUpdater.bind(this),
      matcher: typeaheadMatcher,
    });

    // modify typeahead lookup
    // this = typeahead
    var typeahead = this.inputElement.data('typeahead');
    typeahead.lookup = function () {
      this.query = this.$element.val() || '';
      var items = this.source(this.query, $.proxy(this.process, this));
      return items ? this.process(items) : items;
    };

    this.linkElement.keydown(evt => {
      // trigger typeahead on down arrow or enter key
      if (evt.keyCode === 40 || evt.keyCode === 13) {
        this.linkElement.click();
      }
    });

    this.inputElement.blur(this.inputBlur.bind(this));
  }

  typeaheadSource(query, callback) {
    if (this.options) {
      var typeaheadOptions = _.map(this.options, 'text');

      // add current custom value
      if (this.allowCustom) {
        if (_.indexOf(typeaheadOptions, this.text) === -1) {
          typeaheadOptions.unshift(this.text);
        }
      }

      callback(typeaheadOptions);
    }
  }

  typeaheadUpdater(text) {
    if (text === this.text) {
      clearTimeout(this.cancelBlur);
      this.inputElement.focus();
      return text;
    }

    this.inputElement.val(text);
    this.switchToLink(true);
    return text;
  }

  switchToLink(fromClick) {
    if (this.linkMode && !fromClick) { return; }

    clearTimeout(this.cancelBlur);
    this.cancelBlur = null;
    this.linkMode = true;
    this.inputElement.hide();
    this.linkElement.show();
    this.updateValue(this.inputElement.val());
  }

  inputBlur() {
    // happens long before the click event on the typeahead options
    // need to have long delay because the blur
    this.cancelBlur = setTimeout(this.switchToLink.bind(this), 200);
  }

  updateValue(text) {
    if (text === '' || this.text === text) {
      return;
    }

    this.$scope.$apply(() => {
      var option = _.find(this.options, {text: text});

      if (option) {
        this.value = option.value;
        this.updateDisplay(option.text);
      } else if (this.allowCustom) {
        this.value = text;
        this.updateDisplay(text);
      }

      // needs to call this after digest so
      // property is synced with outerscope
      this.$scope.$$postDigest(() => {
        this.$scope.$apply(() => {
          this.onChange();
        });
      });

    });
  }

  updateDisplay(text) {
    this.text = text;
    this.display = this.$sce.trustAsHtml(this.templateSrv.highlightVariablesAsHtml(text));
  }

  open() {
    this.inputElement.show();

    this.inputElement.css('width', (Math.max(this.linkElement.width(), 80) + 16) + 'px');
    this.inputElement.focus();

    this.linkElement.hide();
    this.linkMode = false;

    var typeahead = this.inputElement.data('typeahead');
    if (typeahead) {
      this.inputElement.val('');
      typeahead.lookup();
    }
  }
}



export function formDropdownDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/core/components/form_dropdown/form_dropdown.html',
    controller: FormDropdownCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      value: "=",
      options: "=",
      getOptions: "&",
      onChange: "&",
      cssClass: "@",
      allowCustom: "@",
    },
    link: function() {
    }
  };
}

coreModule.directive('gfFormDropdown', formDropdownDirective);
