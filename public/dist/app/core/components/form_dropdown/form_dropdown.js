import _ from 'lodash';
import coreModule from '../../core_module';
function typeaheadMatcher(item) {
    var str = this.query;
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
var FormDropdownCtrl = /** @class */ (function () {
    /** @ngInject */
    function FormDropdownCtrl($scope, $element, $sce, templateSrv, $q) {
        var _this = this;
        this.$scope = $scope;
        this.$sce = $sce;
        this.templateSrv = templateSrv;
        this.$q = $q;
        this.inputElement = $element.find('input').first();
        this.linkElement = $element.find('a').first();
        this.linkMode = true;
        this.cancelBlur = null;
        // listen to model changes
        $scope.$watch('ctrl.model', this.modelChanged.bind(this));
        if (this.labelMode) {
            this.cssClasses = 'gf-form-label ' + this.cssClass;
        }
        else {
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
        var typeahead = this.inputElement.data('typeahead');
        typeahead.lookup = function () {
            this.query = this.$element.val() || '';
            this.source(this.query, this.process.bind(this));
        };
        if (this.debounce) {
            typeahead.lookup = _.debounce(typeahead.lookup, 500, { leading: true });
        }
        this.linkElement.keydown(function (evt) {
            // trigger typeahead on down arrow or enter key
            if (evt.keyCode === 40 || evt.keyCode === 13) {
                _this.linkElement.click();
            }
        });
        this.inputElement.keydown(function (evt) {
            if (evt.keyCode === 13) {
                setTimeout(function () {
                    _this.inputElement.blur();
                }, 300);
            }
        });
        this.inputElement.blur(this.inputBlur.bind(this));
        if (this.startOpen) {
            setTimeout(this.open.bind(this), 0);
        }
    }
    FormDropdownCtrl.prototype.getOptionsInternal = function (query) {
        var result = this.getOptions({ $query: query });
        if (this.isPromiseLike(result)) {
            return result;
        }
        return this.$q.when(result);
    };
    FormDropdownCtrl.prototype.isPromiseLike = function (obj) {
        return obj && typeof obj.then === 'function';
    };
    FormDropdownCtrl.prototype.modelChanged = function () {
        var _this = this;
        if (_.isObject(this.model)) {
            this.updateDisplay(this.model.text);
        }
        else {
            // if we have text use it
            if (this.lookupText) {
                this.getOptionsInternal('').then(function (options) {
                    var item = _.find(options, { value: _this.model });
                    _this.updateDisplay(item ? item.text : _this.model);
                });
            }
            else {
                this.updateDisplay(this.model);
            }
        }
    };
    FormDropdownCtrl.prototype.typeaheadSource = function (query, callback) {
        var _this = this;
        this.getOptionsInternal(query).then(function (options) {
            _this.optionCache = options;
            // extract texts
            var optionTexts = _.map(options, function (op) {
                return _.escape(op.text);
            });
            // add custom values
            if (_this.allowCustom && _this.text !== '') {
                if (_.indexOf(optionTexts, _this.text) === -1) {
                    optionTexts.unshift(_this.text);
                }
            }
            callback(optionTexts);
        });
    };
    FormDropdownCtrl.prototype.typeaheadUpdater = function (text) {
        if (text === this.text) {
            clearTimeout(this.cancelBlur);
            this.inputElement.focus();
            return text;
        }
        this.inputElement.val(text);
        this.switchToLink(true);
        return text;
    };
    FormDropdownCtrl.prototype.switchToLink = function (fromClick) {
        if (this.linkMode && !fromClick) {
            return;
        }
        clearTimeout(this.cancelBlur);
        this.cancelBlur = null;
        this.linkMode = true;
        this.inputElement.hide();
        this.linkElement.show();
        this.updateValue(this.inputElement.val());
    };
    FormDropdownCtrl.prototype.inputBlur = function () {
        // happens long before the click event on the typeahead options
        // need to have long delay because the blur
        this.cancelBlur = setTimeout(this.switchToLink.bind(this), 200);
    };
    FormDropdownCtrl.prototype.updateValue = function (text) {
        var _this = this;
        text = _.unescape(text);
        if (text === '' || this.text === text) {
            return;
        }
        this.$scope.$apply(function () {
            var option = _.find(_this.optionCache, { text: text });
            if (option) {
                if (_.isObject(_this.model)) {
                    _this.model = option;
                }
                else {
                    _this.model = option.value;
                }
                _this.text = option.text;
            }
            else if (_this.allowCustom) {
                if (_.isObject(_this.model)) {
                    _this.model.text = _this.model.value = text;
                }
                else {
                    _this.model = text;
                }
                _this.text = text;
            }
            // needs to call this after digest so
            // property is synced with outerscope
            _this.$scope.$$postDigest(function () {
                _this.$scope.$apply(function () {
                    _this.onChange({ $option: option });
                });
            });
        });
    };
    FormDropdownCtrl.prototype.updateDisplay = function (text) {
        this.text = text;
        this.display = this.$sce.trustAsHtml(this.templateSrv.highlightVariablesAsHtml(text));
    };
    FormDropdownCtrl.prototype.open = function () {
        this.inputElement.css('width', Math.max(this.linkElement.width(), 80) + 16 + 'px');
        this.inputElement.show();
        this.inputElement.focus();
        this.linkElement.hide();
        this.linkMode = false;
        var typeahead = this.inputElement.data('typeahead');
        if (typeahead) {
            this.inputElement.val('');
            typeahead.lookup();
        }
    };
    return FormDropdownCtrl;
}());
export { FormDropdownCtrl };
var template = "\n<input type=\"text\"\n  data-provide=\"typeahead\"\n  class=\"gf-form-input\"\n  spellcheck=\"false\"\n  style=\"display:none\">\n</input>\n<a ng-class=\"ctrl.cssClasses\"\n   tabindex=\"1\"\n   ng-click=\"ctrl.open()\"\n   give-focus=\"ctrl.focus\"\n   ng-bind-html=\"ctrl.display || '&nbsp;'\">\n</a>\n";
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
//# sourceMappingURL=form_dropdown.js.map