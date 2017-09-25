///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import config from 'app/core/config';
import _ from 'lodash';
import $ from 'jquery';
import Drop from 'tether-drop';
import coreModule from 'app/core/core_module';
import 'spectrum';

// Spectrum picker uses TinyColor and loads it as a global variable, so we can use it here also
declare var tinycolor;

var picker_template = `
<div class="gf-color-picker">
  <ul class="nav nav-tabs" id="colorpickernav">
    <li class="gf-tabs-item-colorpicker">
      <a href="#gf-colors" data-toggle="tab">Colors</a>
    </li>
    <li class="gf-tabs-item-colorpicker">
      <a href="#spectrum" data-toggle="tab">Spectrum</a>
    </li>
  </ul>
  <div class="colorpicker-container">
    <div id="gf-colors" ng-show="currentTab === 'gf-colors'">
      <div class="graph-legend-popover">
        <p class="m-b-0">
          <i ng-repeat="c in ctrl.colors" class="pointer fa"
            ng-class="{'fa-circle': c !== color, 'fa-circle-o': c === color}"
            ng-style="{color:c}"
            ng-click="ctrl.colorSelected(c);">&nbsp;
          </i>
        </p>
      </div>
    </div>
    <div id="spectrum" ng-show="currentTab === 'spectrum'">
      <div class="spectrum-container"></div>
    </div>
  </div>
  <div class="color-model-container">
    <input class="gf-form-input" ng-model="color" ng-change="onColorStringChange(color)"></input>
  </div>
</div>
`;

export class ColorPickerPopoverCtrl {
  colors: any;
  color: any;
  tabs: any;
  currentTab: string;

  /** @ngInject */
  constructor(private $scope, private $rootScope) {
    this.$scope = $scope;
    this.colors = $rootScope.colors;
    this.color = $scope.color;
  }

  colorSelected(color) {
    this.$scope.sampleColorSelected(color);
    this.color = this.$scope.color;
  }
}

coreModule.directive('colorPickerPopover', function ($timeout, $compile) {
  function link(scope, elem, attrs) {
    scope.tabs = ['gf-colors', 'spectrum'];
    scope.currentTab = scope.tabs[0];

    scope.sampleColorSelected = sampleColorSelected;
    scope.onColorStringChange = onColorStringChange;

    let pickernav = elem.find("#colorpickernav");
    let spectrumTab = elem.find('#spectrum');
    pickernav.find('li:first').addClass('active');

    let spectrumOptions = angular.extend({
      flat: true,
      showAlpha: true,
      showButtons: false,
      color: scope.color,
      appendTo: elem.find('.spectrum-container'),
      move: onSpectrumMove,
    }, scope.$eval(attrs.options));

    // switch category by click on tab
    pickernav.on('show', e => {
      // use href attr (#name => name)
      let tab = e.target.hash.slice(1);
      scope.$apply(() => {
        scope.currentTab = tab;
      });

      toggleSpectrumPicker(tab);
    });

    function onColorStringChange(colorString) {
      let newColor = tinycolor(colorString);
      if (newColor.isValid()) {
        scope.color = newColor.toString();
      }
    }

    function sampleColorSelected(color) {
      scope.color = color;
    }

    function spectrumColorSelected(color) {
      // let rgbColor = color.toHex8String().toUpperCase();
      let rgbColor = color.toRgbString();
      scope.color = rgbColor;
    }

    function onSpectrumMove(color) {
      scope.$apply(() => {
        spectrumColorSelected(color);
      });
    }

    function toggleSpectrumPicker(tab) {
      if (tab === 'spectrum') {
        spectrumTab.spectrum(spectrumOptions);
        spectrumTab.spectrum('show');
        spectrumTab.spectrum('set', scope.color);
      } else {
        spectrumTab.spectrum('destroy');
      }
    }
  }

  return {
    restrict: 'E',
    link: link,
    controller: ColorPickerPopoverCtrl,
    controllerAs: 'ctrl',
    scope: {
      color: "="
    },
    template: picker_template
  };
});

let picker_button_template = `
<div class="sp-replacer sp-light" ng-click="ctrl.openColorPicker($event)">
  <div class="sp-preview">
    <div class="sp-preview-inner" ng-style="{'background-color': color}">
    </div>
  </div>
</div>
`;

let drop_template = `
<color-picker-popover color="color">
</color-picker-popover>
`;

export class ColorPickerCtrl {
  colorPickerDrop: any;

  /** @ngInject */
  constructor(private $scope, private $rootScope, private $timeout, private $compile) {
    this.$scope = $scope;
    this.colorPickerDrop = null;
  }

  openColorPicker(e) {
    let el = $(e.currentTarget);

    this.$timeout(() => {
      let options = {
        template: drop_template
      };

      var contentElement = document.createElement('div');
      contentElement.innerHTML = options.template;
      this.$compile(contentElement)(this.$scope);

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

      this.colorPickerDrop = drop;
      this.colorPickerDrop.open();
    });
  }

  close() {
    this.$timeout(() => {
      if (this.colorPickerDrop && this.colorPickerDrop.tether) {
        this.colorPickerDrop.destroy();
      }
    });
  }
}

export function colorPicker() {
  function link(scope, elem, attrs) {
    scope.$watch('color', (newValue, oldValue) => {
      if (newValue !== oldValue) {
        scope.onChange();
        if (newValue !== scope.color) {
          scope.color = newValue;
        }
      }
    });
  }

  return {
    restrict: 'E',
    controller: ColorPickerCtrl,
    controllerAs: 'ctrl',
    scope: {
      color: "=",
      onChange: "&"
    },
    template: picker_button_template,
    link: link
  };
}

coreModule.directive('colorPicker', colorPicker);
