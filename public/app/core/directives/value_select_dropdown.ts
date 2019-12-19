import angular, { IScope } from 'angular';
import debounce from 'lodash/debounce';
import each from 'lodash/each';
import filter from 'lodash/filter';
import find from 'lodash/find';
import indexOf from 'lodash/indexOf';
import map from 'lodash/map';
import { e2e } from '@grafana/e2e';

import coreModule from '../core_module';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { containsSearchFilter } from '../../features/templating/variable';

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
  queryHasSearchFilter: boolean;
  debouncedQueryChanged: Function;
  selectors: typeof e2e.pages.Dashboard.SubMenu.selectors;

  /** @ngInject */
  constructor(private $scope: IScope) {
    this.queryHasSearchFilter = this.variable ? containsSearchFilter(this.variable.query) : false;
    this.debouncedQueryChanged = debounce(this.queryChanged.bind(this), 200);
    this.selectors = e2e.pages.Dashboard.SubMenu.selectors;
  }

  show() {
    this.oldVariableText = this.variable.current.text;
    this.highlightIndex = -1;

    this.options = this.variable.options;
    this.selectedValues = filter(this.options, { selected: true });

    this.tags = map(this.variable.tags, value => {
      let tag = { text: value, selected: false };
      each(this.variable.current.tags, tagObj => {
        if (tagObj.text === value) {
          tag = tagObj;
        }
      });
      return tag;
    });

    // new behaviour, if this is a query that uses searchfilter it might be a nicer
    // user experience to show the last typed search query in the input field
    const query = this.queryHasSearchFilter && this.search && this.search.query ? this.search.query : '';

    this.search = {
      query,
      options: this.options.slice(0, Math.min(this.options.length, 1000)),
    };

    this.dropdownVisible = true;
  }

  updateLinkText() {
    const current = this.variable.current;

    if (current.tags && current.tags.length) {
      // filer out values that are in selected tags
      const selectedAndNotInTag = filter(this.variable.options, option => {
        if (!option.selected) {
          return false;
        }
        for (let i = 0; i < current.tags.length; i++) {
          const tag = current.tags[i];
          if (indexOf(tag.values, option.value) !== -1) {
            return false;
          }
        }
        return true;
      });

      // convert values to text
      const currentTexts = map(selectedAndNotInTag, 'text');

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
    this.selectedValues = filter(this.options, { selected: true });

    if (this.selectedValues.length) {
      each(this.options, option => {
        option.selected = false;
      });
    } else {
      each(this.search.options, option => {
        option.selected = true;
      });
    }
    this.selectionsChanged(false);
  }

  selectTag(tag: any) {
    tag.selected = !tag.selected;
    let tagValuesPromise;
    if (!tag.values) {
      tagValuesPromise = this.variable.getValuesForTag(tag.text);
    } else {
      tagValuesPromise = Promise.resolve(tag.values);
    }

    return tagValuesPromise.then((values: any) => {
      tag.values = values;
      tag.valuesText = values.join(' + ');
      each(this.options, option => {
        if (indexOf(tag.values, option.value) !== -1) {
          option.selected = tag.selected;
        }
      });

      this.selectionsChanged(false);
    });
  }

  keyDown(evt: any) {
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
        this.selectValue(this.search.options[this.highlightIndex], {}, true);
      }
    }
    if (evt.keyCode === 32) {
      this.selectValue(this.search.options[this.highlightIndex], {}, false);
    }
  }

  moveHighlight(direction: number) {
    this.highlightIndex = (this.highlightIndex + direction) % this.search.options.length;
  }

  selectValue(option: any, event: any, commitChange?: boolean) {
    if (!option) {
      return;
    }

    option.selected = this.variable.multi ? !option.selected : true;

    commitChange = commitChange || false;

    const setAllExceptCurrentTo = (newValue: any) => {
      each(this.options, other => {
        if (option !== other) {
          other.selected = newValue;
        }
      });
    };

    // commit action (enter key), should not deselect it
    if (commitChange) {
      option.selected = true;
    }

    if (option.text === 'All') {
      // always clear search query if all is marked
      this.search.query = '';
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

  selectionsChanged(commitChange: boolean) {
    this.selectedValues = filter(this.options, { selected: true });

    if (this.selectedValues.length > 1) {
      if (this.selectedValues[0].text === 'All') {
        this.selectedValues[0].selected = false;
        this.selectedValues = this.selectedValues.slice(1, this.selectedValues.length);
      }
    }

    // validate selected tags
    each(this.tags, tag => {
      if (tag.selected) {
        each(tag.values, value => {
          if (!find(this.selectedValues, { value: value })) {
            tag.selected = false;
          }
        });
      }
    });

    this.selectedTags = filter(this.tags, { selected: true });
    this.variable.current.value = map(this.selectedValues, 'value');
    this.variable.current.text = map(this.selectedValues, 'text').join(' + ');
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
    if (this.queryHasSearchFilter) {
      this.updateLazyLoadedOptions();
    }

    if (this.variable.current.text !== this.oldVariableText) {
      this.onUpdated();
    }
  }

  async queryChanged() {
    if (this.queryHasSearchFilter) {
      await this.updateLazyLoadedOptions();
      return;
    }

    const options = filter(this.options, option => {
      return option.text.toLowerCase().indexOf(this.search.query.toLowerCase()) !== -1;
    });

    this.updateUIBoundOptions(this.$scope, options);
  }

  init() {
    this.selectedTags = this.variable.current.tags || [];
    this.updateLinkText();
  }

  async updateLazyLoadedOptions() {
    this.options = await this.lazyLoadOptions(this.search.query);
    this.updateUIBoundOptions(this.$scope, this.options);
  }

  async lazyLoadOptions(query: string): Promise<any[]> {
    await this.variable.updateOptions(query);
    return this.variable.options;
  }

  updateUIBoundOptions($scope: IScope, options: any[]) {
    this.highlightIndex = 0;
    this.search.options = options.slice(0, Math.min(options.length, 1000));
    $scope.$apply();
  }
}

/** @ngInject */
export function valueSelectDropdown($compile: any, $window: any, $timeout: any, $rootScope: GrafanaRootScope) {
  return {
    scope: { dashboard: '=', variable: '=', onUpdated: '&' },
    templateUrl: 'public/app/partials/valueSelectDropdown.html',
    controller: 'ValueSelectDropdownCtrl',
    controllerAs: 'vm',
    bindToController: true,
    link: (scope: any, elem: any) => {
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

      function bodyOnClick(e: any) {
        if (elem.has(e.target).length === 0) {
          scope.$apply(() => {
            scope.vm.commitChanges();
          });
        }
      }

      scope.$watch('vm.dropdownVisible', (newValue: any) => {
        if (newValue) {
          openDropdown();
        } else {
          switchToLink();
        }
      });

      scope.vm.dashboard.on(
        'template-variable-value-updated',
        () => {
          scope.vm.updateLinkText();
        },
        scope
      );

      scope.vm.init();
    },
  };
}

coreModule.controller('ValueSelectDropdownCtrl', ValueSelectDropdownCtrl);
coreModule.directive('valueSelectDropdown', valueSelectDropdown);
