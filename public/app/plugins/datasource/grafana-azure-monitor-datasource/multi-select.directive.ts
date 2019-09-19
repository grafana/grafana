import angular from 'angular';
import _ from 'lodash';

export class MultiSelectDropdownCtrl {
  dropdownVisible: boolean;
  highlightIndex: number;
  linkText: string;
  options: Array<{ selected: boolean; text: string; value: string; variable: boolean }>;
  selectedValues: Array<{ text: string; value: string }>;
  initialValues: string[];
  onUpdated: any;

  show() {
    this.highlightIndex = -1;
    this.options = this.options;
    this.selectedValues = this.options.filter(({ selected }) => selected);

    this.dropdownVisible = true;
  }

  hide() {
    this.dropdownVisible = false;
  }

  updateLinkText() {
    this.linkText =
      this.selectedValues.length === 1 ? this.selectedValues[0].text : `(${this.selectedValues.length}) selected`;
  }

  clearSelections() {
    this.selectedValues = this.options.filter(({ selected }) => selected);

    if (this.selectedValues.length > 1) {
      this.options.forEach(option => {
        option.selected = false;
      });
    } else {
      this.options.forEach(option => {
        option.selected = true;
      });
    }
    this.selectionsChanged();
  }

  selectValue(option: any) {
    if (!option) {
      return;
    }

    option.selected = !option.selected;
    this.selectionsChanged();
  }

  selectionsChanged() {
    this.selectedValues = this.options.filter(({ selected }) => selected);
    if (!this.selectedValues.length && this.options.length) {
      this.selectedValues = this.options.slice(0, 1);
    }
    this.updateLinkText();
    this.onUpdated({ values: this.selectedValues.map(({ value }) => value) });
  }

  onClickOutside() {
    this.selectedValues = this.options.filter(({ selected }) => selected);
    if (this.selectedValues.length === 0) {
      this.options[0].selected = true;
      this.selectionsChanged();
    }
    this.dropdownVisible = false;
  }

  init() {
    if (!this.options) {
      return;
    }

    this.options = this.options.map(o => ({
      ...o,
      selected: this.initialValues.includes(o.value),
    }));

    this.selectedValues = this.options.filter(({ selected }) => selected);
    this.updateLinkText();
  }

  updateSelection() {
    this.selectedValues = this.options.filter(({ selected }) => selected);
    if (!this.selectedValues.length && this.options.length) {
      this.options = this.options.map(o => ({
        ...o,
        selected: !o.variable,
      }));
      this.selectedValues = this.options.filter(({ selected }) => selected);
      this.selectionsChanged();
    }
    this.updateLinkText();
  }
}

/** @ngInject */
export function multiSelectDropdown($window: any, $timeout: any) {
  return {
    scope: { onUpdated: '&', options: '=', initialValues: '=' },
    templateUrl: 'public/app/plugins/datasource/grafana-azure-monitor-datasource/partials/multi-select.directive.html',
    controller: MultiSelectDropdownCtrl,
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
            bodyEl.on('click', () => {
              bodyEl.on('click', bodyOnClick);
            });
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
            scope.vm.onClickOutside();
          });
        }
      }

      scope.$watch('vm.options', (newValue: any) => {
        if (newValue) {
          scope.vm.updateSelection(newValue);
        }
      });

      scope.$watch('vm.dropdownVisible', (newValue: any) => {
        if (newValue) {
          openDropdown();
        } else {
          switchToLink();
        }
      });

      scope.vm.init();
    },
  };
}

angular.module('grafana.directives').directive('multiSelect', multiSelectDropdown);
