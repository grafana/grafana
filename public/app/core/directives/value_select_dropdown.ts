import angular from 'angular';
import _ from 'lodash';
import coreModule from '../core_module';

export class ValueSelectDropdownCtrl {
  dropdownVisible: any;
  highlightIndex: any;
  linkText: any;
  oldVariableText: any;
  options: any;
  search: any;
  selectedTags: any;
  selectedValues: any;
  tags: any;
  variable: any;

  hide: any;
  onUpdated: any;

  /** @ngInject */
  constructor(private $q) {}

  show() {
    this.oldVariableText = this.variable.current.text;
    this.highlightIndex = -1;

    this.options = this.variable.options;
    this.selectedValues = _.filter(this.options, { selected: true });

    this.tags = _.map(this.variable.tags, value => {
      let tag = { text: value, selected: false };
      _.each(this.variable.current.tags, tagObj => {
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
  }

  updateLinkText() {
    const current = this.variable.current;

    if (current.tags && current.tags.length) {
      // filer out values that are in selected tags
      const selectedAndNotInTag = _.filter(this.variable.options, option => {
        if (!option.selected) {
          return false;
        }
        for (let i = 0; i < current.tags.length; i++) {
          const tag = current.tags[i];
          if (_.indexOf(tag.values, option.value) !== -1) {
            return false;
          }
        }
        return true;
      });

      // convert values to text
      const currentTexts = _.map(selectedAndNotInTag, 'text');

      // join texts
      this.linkText = currentTexts.join(' + ');
      if (this.linkText.length > 0) {
        this.linkText += ' + ';
      }
    } else {
      this.linkText = this.variable.current.text;
    }
  }

  clearSelections() {
    _.each(this.options, option => {
      option.selected = false;
    });

    this.selectionsChanged(false);
  }

  selectTag(tag) {
    tag.selected = !tag.selected;
    let tagValuesPromise;
    if (!tag.values) {
      tagValuesPromise = this.variable.getValuesForTag(tag.text);
    } else {
      tagValuesPromise = this.$q.when(tag.values);
    }

    return tagValuesPromise.then(values => {
      tag.values = values;
      tag.valuesText = values.join(' + ');
      _.each(this.options, option => {
        if (_.indexOf(tag.values, option.value) !== -1) {
          option.selected = tag.selected;
        }
      });

      this.selectionsChanged(false);
    });
  }

  keyDown(evt) {
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
      } else {
        this.selectValue(this.search.options[this.highlightIndex], {}, true, false);
      }
    }
    if (evt.keyCode === 32) {
      this.selectValue(this.search.options[this.highlightIndex], {}, false, false);
    }
  }

  moveHighlight(direction) {
    this.highlightIndex = (this.highlightIndex + direction) % this.search.options.length;
  }

  selectValue(option, event, commitChange?, excludeOthers?) {
    if (!option) {
      return;
    }

    option.selected = this.variable.multi ? !option.selected : true;

    commitChange = commitChange || false;
    excludeOthers = excludeOthers || false;

    const setAllExceptCurrentTo = newValue => {
      _.each(this.options, other => {
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
    } else if (!this.variable.multi) {
      setAllExceptCurrentTo(false);
      commitChange = true;
    } else if (event.ctrlKey || event.metaKey || event.shiftKey) {
      commitChange = true;
      setAllExceptCurrentTo(false);
    }

    this.selectionsChanged(commitChange);
  }

  selectionsChanged(commitChange) {
    this.selectedValues = _.filter(this.options, { selected: true });

    if (this.selectedValues.length > 1) {
      if (this.selectedValues[0].text === 'All') {
        this.selectedValues[0].selected = false;
        this.selectedValues = this.selectedValues.slice(1, this.selectedValues.length);
      }
    }

    // validate selected tags
    _.each(this.tags, tag => {
      if (tag.selected) {
        _.each(tag.values, value => {
          if (!_.find(this.selectedValues, { value: value })) {
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
  }

  commitChanges() {
    // if we have a search query and no options use that
    if (this.search.options.length === 0 && this.search.query.length > 0) {
      this.variable.current = { text: this.search.query, value: this.search.query };
    } else if (this.selectedValues.length === 0) {
      // make sure one option is selected
      this.options[0].selected = true;
      this.selectionsChanged(false);
    }

    this.dropdownVisible = false;
    this.updateLinkText();

    if (this.variable.current.text !== this.oldVariableText) {
      this.onUpdated();
    }
  }

  queryChanged() {
    this.highlightIndex = -1;
    this.search.options = _.filter(this.options, option => {
      return option.text.toLowerCase().indexOf(this.search.query.toLowerCase()) !== -1;
    });

    this.search.options = this.search.options.slice(0, Math.min(this.search.options.length, 1000));
  }

  init() {
    this.selectedTags = this.variable.current.tags || [];
    this.updateLinkText();
  }
}

/** @ngInject */
export function valueSelectDropdown($compile, $window, $timeout, $rootScope) {
  return {
    scope: { variable: '=', onUpdated: '&' },
    templateUrl: 'public/app/partials/valueSelectDropdown.html',
    controller: 'ValueSelectDropdownCtrl',
    controllerAs: 'vm',
    bindToController: true,
    link: (scope, elem) => {
      const bodyEl = angular.element($window.document.body);
      const linkEl = elem.find('.variable-value-link');
      const inputEl = elem.find('input');

      function openDropdown() {
        inputEl.css('width', Math.max(linkEl.width(), 80) + 'px');

        inputEl.show();
        linkEl.hide();

        inputEl.focus();
        $timeout(
          () => {
            bodyEl.on('click', bodyOnClick);
          },
          0,
          false
        );
      }

      function switchToLink() {
        inputEl.hide();
        linkEl.show();
        bodyEl.off('click', bodyOnClick);
      }

      function bodyOnClick(e) {
        if (elem.has(e.target).length === 0) {
          scope.$apply(() => {
            scope.vm.commitChanges();
          });
        }
      }

      scope.$watch('vm.dropdownVisible', newValue => {
        if (newValue) {
          openDropdown();
        } else {
          switchToLink();
        }
      });

      const cleanUp = $rootScope.$on('template-variable-value-updated', () => {
        scope.vm.updateLinkText();
      });

      scope.$on('$destroy', () => {
        cleanUp();
      });

      scope.vm.init();
    },
  };
}

coreModule.controller('ValueSelectDropdownCtrl', ValueSelectDropdownCtrl);
coreModule.directive('valueSelectDropdown', valueSelectDropdown);
