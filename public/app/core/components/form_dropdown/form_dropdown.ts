import _ from 'lodash';
import coreModule from '../../core_module';
import { ISCEService } from 'angular';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

function typeaheadMatcher(this: any, item: string) {
  let str = this.query;
  if (str === '') {
    return true;
  }
  if (str[0] === '/') {
    str = str.substring(1);
  }
  if (str[str.length - 1] === '/') {
    str = str.substring(0, str.length - 1);
  }
  return item.toLowerCase().match(str.toLowerCase());
}

export class FormDropdownCtrl {
  inputElement: JQLite;
  linkElement: JQLite;
  model: any;
  display: any;
  text: any;
  options: any;
  cssClass: any;
  cssClasses: any;
  allowCustom: any;
  labelMode: boolean;
  linkMode: boolean;
  cancelBlur: any;
  onChange: any;
  getOptions: any;
  optionCache: any;
  lookupText: boolean;
  placeholder: any;
  startOpen: any;
  debounce: number;

  /** @ngInject */
  constructor(private $scope: any, $element: JQLite, private $sce: ISCEService, private templateSrv: any) {
    this.inputElement = $element.find('input').first();
    this.linkElement = $element.find('a').first();
    this.linkMode = true;
    this.cancelBlur = null;

    // listen to model changes
    $scope.$watch('ctrl.model', this.modelChanged.bind(this));

    if (this.labelMode) {
      this.cssClasses = 'gf-form-label ' + this.cssClass;
    } else {
      this.cssClasses = 'gf-form-input gf-form-input--dropdown ' + this.cssClass;
    }

    if (this.placeholder) {
      this.inputElement.attr('placeholder', this.placeholder);
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
    const typeahead = this.inputElement.data('typeahead');
    typeahead.lookup = function() {
      this.query = this.$element.val() || '';
      this.source(this.query, this.process.bind(this));
    };

    if (this.debounce) {
      typeahead.lookup = _.debounce(typeahead.lookup, 500, { leading: true });
    }

    this.linkElement.keydown(evt => {
      // trigger typeahead on down arrow or enter key
      if (evt.keyCode === 40 || evt.keyCode === 13) {
        this.linkElement.click();
      }
    });

    this.inputElement.keydown(evt => {
      if (evt.keyCode === 13) {
        setTimeout(() => {
          this.inputElement.blur();
        }, 300);
      }
    });

    this.inputElement.blur(this.inputBlur.bind(this));

    if (this.startOpen) {
      setTimeout(this.open.bind(this), 0);
    }
  }

  getOptionsInternal(query: string) {
    return promiseToDigest(this.$scope)(Promise.resolve(this.getOptions({ $query: query })));
  }

  isPromiseLike(obj: any) {
    return obj && typeof obj.then === 'function';
  }

  modelChanged() {
    if (_.isObject(this.model)) {
      this.updateDisplay((this.model as any).text);
    } else {
      // if we have text use it
      if (this.lookupText) {
        this.getOptionsInternal('').then((options: any) => {
          const item: any = _.find(options, { value: this.model });
          this.updateDisplay(item ? item.text : this.model);
        });
      } else {
        this.updateDisplay(this.model);
      }
    }
  }

  typeaheadSource(query: string, callback: (res: any) => void) {
    this.getOptionsInternal(query).then((options: any) => {
      this.optionCache = options;

      // extract texts
      const optionTexts = _.map(options, (op: any) => {
        return _.escape(op.text);
      });

      // add custom values
      if (this.allowCustom && this.text !== '') {
        if (_.indexOf(optionTexts, this.text) === -1) {
          optionTexts.unshift(this.text);
        }
      }

      callback(optionTexts);
    });
  }

  typeaheadUpdater(text: string) {
    if (text === this.text) {
      clearTimeout(this.cancelBlur);
      this.inputElement.focus();
      return text;
    }

    this.inputElement.val(text);
    this.switchToLink(true);
    return text;
  }

  switchToLink(fromClick: boolean) {
    if (this.linkMode && !fromClick) {
      return;
    }

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

  updateValue(text: string) {
    text = _.unescape(text);

    if (text === '' || this.text === text) {
      return;
    }

    this.$scope.$apply(() => {
      const option: any = _.find(this.optionCache, { text: text });

      if (option) {
        if (_.isObject(this.model)) {
          this.model = option;
        } else {
          this.model = option.value;
        }
        this.text = option.text;
      } else if (this.allowCustom) {
        if (_.isObject(this.model)) {
          (this.model as any).text = (this.model as any).value = text;
        } else {
          this.model = text;
        }
        this.text = text;
      }

      // needs to call this after digest so
      // property is synced with outerscope
      this.$scope.$$postDigest(() => {
        this.$scope.$apply(() => {
          this.onChange({ $option: option });
        });
      });
    });
  }

  updateDisplay(text: string) {
    this.text = text;
    this.display = this.$sce.trustAsHtml(this.templateSrv.highlightVariablesAsHtml(text));
  }

  open() {
    this.inputElement.css('width', Math.max(this.linkElement.width()!, 80) + 16 + 'px');

    this.inputElement.show();
    this.inputElement.focus();

    this.linkElement.hide();
    this.linkMode = false;

    const typeahead = this.inputElement.data('typeahead');
    if (typeahead) {
      this.inputElement.val('');
      typeahead.lookup();
    }
  }
}

const template = `
<input type="text"
  data-provide="typeahead"
  class="gf-form-input"
  spellcheck="false"
  style="display:none">
</input>
<a ng-class="ctrl.cssClasses"
   tabindex="1"
   ng-click="ctrl.open()"
   give-focus="ctrl.focus"
   ng-bind-html="ctrl.display || '&nbsp;'">
</a>
`;

export function formDropdownDirective() {
  return {
    restrict: 'E',
    template: template,
    controller: FormDropdownCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      model: '=',
      getOptions: '&',
      onChange: '&',
      cssClass: '@',
      allowCustom: '@',
      labelMode: '@',
      lookupText: '@',
      placeholder: '@',
      startOpen: '@',
      debounce: '@',
    },
  };
}

coreModule.directive('gfFormDropdown', formDropdownDirective);
