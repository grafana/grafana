// import _ from 'lodash';
import coreModule from '../../core_module';

export class SearchResultsCtrl {
  results: any;
  onSelectionChanged: any;
  onTagSelected: any;

  toggleFolderExpand(section) {
    if (section.toggle) {
      section.toggle(section);
    }
  }

  toggleSelection(item, evt) {
    item.checked = !item.checked;

    if (this.onSelectionChanged) {
      this.onSelectionChanged();
    }

    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }

  selectTag(tag, evt) {
    if (this.onTagSelected) {
      this.onTagSelected({$tag: tag});
    }

    if (evt) {
      evt.stopPropagation();
      evt.preventDefault();
    }
  }
}

export function searchResultsDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/core/components/search/search_results.html',
    controller: SearchResultsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      editable: '@',
      results: '=',
      onSelectionChanged: '&',
      onTagSelected: '&'
    },
  };
}

coreModule.directive('dashboardSearchResults', searchResultsDirective);
