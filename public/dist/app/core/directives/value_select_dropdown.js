import angular from 'angular';
import _ from 'lodash';
import coreModule from '../core_module';
var ValueSelectDropdownCtrl = /** @class */ (function () {
    /** @ngInject */
    function ValueSelectDropdownCtrl($q) {
        this.$q = $q;
    }
    ValueSelectDropdownCtrl.prototype.show = function () {
        var _this = this;
        this.oldVariableText = this.variable.current.text;
        this.highlightIndex = -1;
        this.options = this.variable.options;
        this.selectedValues = _.filter(this.options, { selected: true });
        this.tags = _.map(this.variable.tags, function (value) {
            var tag = { text: value, selected: false };
            _.each(_this.variable.current.tags, function (tagObj) {
                if (tagObj.text === value) {
                    tag = tagObj;
                }
            });
            return tag;
        });
        this.search = {
            query: '',
            options: this.options.slice(0, Math.min(this.options.length, 1000)),
        };
        this.dropdownVisible = true;
    };
    ValueSelectDropdownCtrl.prototype.updateLinkText = function () {
        var current = this.variable.current;
        if (current.tags && current.tags.length) {
            // filer out values that are in selected tags
            var selectedAndNotInTag = _.filter(this.variable.options, function (option) {
                if (!option.selected) {
                    return false;
                }
                for (var i = 0; i < current.tags.length; i++) {
                    var tag = current.tags[i];
                    if (_.indexOf(tag.values, option.value) !== -1) {
                        return false;
                    }
                }
                return true;
            });
            // convert values to text
            var currentTexts = _.map(selectedAndNotInTag, 'text');
            // join texts
            this.linkText = currentTexts.join(' + ');
            if (this.linkText.length > 0) {
                this.linkText += ' + ';
            }
        }
        else {
            this.linkText = this.variable.current.text;
        }
    };
    ValueSelectDropdownCtrl.prototype.clearSelections = function () {
        _.each(this.options, function (option) {
            option.selected = false;
        });
        this.selectionsChanged(false);
    };
    ValueSelectDropdownCtrl.prototype.selectTag = function (tag) {
        var _this = this;
        tag.selected = !tag.selected;
        var tagValuesPromise;
        if (!tag.values) {
            tagValuesPromise = this.variable.getValuesForTag(tag.text);
        }
        else {
            tagValuesPromise = this.$q.when(tag.values);
        }
        return tagValuesPromise.then(function (values) {
            tag.values = values;
            tag.valuesText = values.join(' + ');
            _.each(_this.options, function (option) {
                if (_.indexOf(tag.values, option.value) !== -1) {
                    option.selected = tag.selected;
                }
            });
            _this.selectionsChanged(false);
        });
    };
    ValueSelectDropdownCtrl.prototype.keyDown = function (evt) {
        if (evt.keyCode === 27) {
            this.hide();
        }
        if (evt.keyCode === 40) {
            this.moveHighlight(1);
        }
        if (evt.keyCode === 38) {
            this.moveHighlight(-1);
        }
        if (evt.keyCode === 13) {
            if (this.search.options.length === 0) {
                this.commitChanges();
            }
            else {
                this.selectValue(this.search.options[this.highlightIndex], {}, true, false);
            }
        }
        if (evt.keyCode === 32) {
            this.selectValue(this.search.options[this.highlightIndex], {}, false, false);
        }
    };
    ValueSelectDropdownCtrl.prototype.moveHighlight = function (direction) {
        this.highlightIndex = (this.highlightIndex + direction) % this.search.options.length;
    };
    ValueSelectDropdownCtrl.prototype.selectValue = function (option, event, commitChange, excludeOthers) {
        var _this = this;
        if (!option) {
            return;
        }
        option.selected = this.variable.multi ? !option.selected : true;
        commitChange = commitChange || false;
        excludeOthers = excludeOthers || false;
        var setAllExceptCurrentTo = function (newValue) {
            _.each(_this.options, function (other) {
                if (option !== other) {
                    other.selected = newValue;
                }
            });
        };
        // commit action (enter key), should not deselect it
        if (commitChange) {
            option.selected = true;
        }
        if (option.text === 'All' || excludeOthers) {
            setAllExceptCurrentTo(false);
            commitChange = true;
        }
        else if (!this.variable.multi) {
            setAllExceptCurrentTo(false);
            commitChange = true;
        }
        else if (event.ctrlKey || event.metaKey || event.shiftKey) {
            commitChange = true;
            setAllExceptCurrentTo(false);
        }
        this.selectionsChanged(commitChange);
    };
    ValueSelectDropdownCtrl.prototype.selectionsChanged = function (commitChange) {
        var _this = this;
        this.selectedValues = _.filter(this.options, { selected: true });
        if (this.selectedValues.length > 1) {
            if (this.selectedValues[0].text === 'All') {
                this.selectedValues[0].selected = false;
                this.selectedValues = this.selectedValues.slice(1, this.selectedValues.length);
            }
        }
        // validate selected tags
        _.each(this.tags, function (tag) {
            if (tag.selected) {
                _.each(tag.values, function (value) {
                    if (!_.find(_this.selectedValues, { value: value })) {
                        tag.selected = false;
                    }
                });
            }
        });
        this.selectedTags = _.filter(this.tags, { selected: true });
        this.variable.current.value = _.map(this.selectedValues, 'value');
        this.variable.current.text = _.map(this.selectedValues, 'text').join(' + ');
        this.variable.current.tags = this.selectedTags;
        if (!this.variable.multi) {
            this.variable.current.value = this.selectedValues[0].value;
        }
        if (commitChange) {
            this.commitChanges();
        }
    };
    ValueSelectDropdownCtrl.prototype.commitChanges = function () {
        // if we have a search query and no options use that
        if (this.search.options.length === 0 && this.search.query.length > 0) {
            this.variable.current = { text: this.search.query, value: this.search.query };
        }
        else if (this.selectedValues.length === 0) {
            // make sure one option is selected
            this.options[0].selected = true;
            this.selectionsChanged(false);
        }
        this.dropdownVisible = false;
        this.updateLinkText();
        if (this.variable.current.text !== this.oldVariableText) {
            this.onUpdated();
        }
    };
    ValueSelectDropdownCtrl.prototype.queryChanged = function () {
        var _this = this;
        this.highlightIndex = -1;
        this.search.options = _.filter(this.options, function (option) {
            return option.text.toLowerCase().indexOf(_this.search.query.toLowerCase()) !== -1;
        });
        this.search.options = this.search.options.slice(0, Math.min(this.search.options.length, 1000));
    };
    ValueSelectDropdownCtrl.prototype.init = function () {
        this.selectedTags = this.variable.current.tags || [];
        this.updateLinkText();
    };
    return ValueSelectDropdownCtrl;
}());
export { ValueSelectDropdownCtrl };
/** @ngInject */
export function valueSelectDropdown($compile, $window, $timeout, $rootScope) {
    return {
        scope: { dashboard: '=', variable: '=', onUpdated: '&' },
        templateUrl: 'public/app/partials/valueSelectDropdown.html',
        controller: 'ValueSelectDropdownCtrl',
        controllerAs: 'vm',
        bindToController: true,
        link: function (scope, elem) {
            var bodyEl = angular.element($window.document.body);
            var linkEl = elem.find('.variable-value-link');
            var inputEl = elem.find('input');
            function openDropdown() {
                inputEl.css('width', Math.max(linkEl.width(), 80) + 'px');
                inputEl.show();
                linkEl.hide();
                inputEl.focus();
                $timeout(function () {
                    bodyEl.on('click', bodyOnClick);
                }, 0, false);
            }
            function switchToLink() {
                inputEl.hide();
                linkEl.show();
                bodyEl.off('click', bodyOnClick);
            }
            function bodyOnClick(e) {
                if (elem.has(e.target).length === 0) {
                    scope.$apply(function () {
                        scope.vm.commitChanges();
                    });
                }
            }
            scope.$watch('vm.dropdownVisible', function (newValue) {
                if (newValue) {
                    openDropdown();
                }
                else {
                    switchToLink();
                }
            });
            scope.vm.dashboard.on('template-variable-value-updated', function () {
                scope.vm.updateLinkText();
            }, scope);
            scope.vm.init();
        },
    };
}
coreModule.controller('ValueSelectDropdownCtrl', ValueSelectDropdownCtrl);
coreModule.directive('valueSelectDropdown', valueSelectDropdown);
//# sourceMappingURL=value_select_dropdown.js.map