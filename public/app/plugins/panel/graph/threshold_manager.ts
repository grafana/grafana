import 'vendor/flot/jquery.flot';
import $ from 'jquery';
import _ from 'lodash';
import { getColorFromHexRgbOrName } from '@grafana/data';
import { CoreEvents } from 'app/types';
import { PanelCtrl } from 'app/features/panel/panel_ctrl';

export class ThresholdManager {
  plot: any;
  placeholder: any;
  height: any;
  thresholds: any;
  needsCleanup: boolean;
  hasSecondYAxis: any;

  constructor(private panelCtrl: PanelCtrl) {}

  getHandleHtml(handleIndex: any, model: { colorMode: string }, valueStr: any) {
    let stateClass = model.colorMode;
    if (model.colorMode === 'custom') {
      stateClass = 'critical';
    }

    return `
    <div class="alert-handle-wrapper alert-handle-wrapper--T${handleIndex}">
      <div class="alert-handle-line alert-handle-line--${stateClass}">
      </div>
      <div class="alert-handle" data-handle-index="${handleIndex}">
        <i class="icon-gf icon-gf-${stateClass} alert-state-${stateClass}"></i>
        <span class="alert-handle-value">${valueStr}<i class="alert-handle-grip"></i></span>
      </div>
    </div>`;
  }

  initDragging(evt: any) {
    const handleElem = $(evt.currentTarget).parents('.alert-handle-wrapper');
    const handleIndex = $(evt.currentTarget).data('handleIndex');

    let lastY: number | null = null;
    let posTop: number;
    const plot = this.plot;
    const panelCtrl = this.panelCtrl;
    const model = this.thresholds[handleIndex];

    function dragging(evt: any) {
      if (lastY === null) {
        lastY = evt.clientY;
      } else {
        const diff = evt.clientY - lastY;
        posTop = posTop + diff;
        lastY = evt.clientY;
        handleElem.css({ top: posTop + diff });
      }
    }

    function stopped() {
      // calculate graph level
      let graphValue = plot.c2p({ left: 0, top: posTop }).y;
      graphValue = parseInt(graphValue.toFixed(0), 10);
      model.value = graphValue;

      handleElem.off('mousemove', dragging);
      handleElem.off('mouseup', dragging);
      handleElem.off('mouseleave', dragging);

      // trigger digest and render
      panelCtrl.$scope.$apply(() => {
        panelCtrl.render();
        panelCtrl.events.emit(CoreEvents.thresholdChanged, {
          threshold: model,
          handleIndex: handleIndex,
        });
      });
    }

    lastY = null;
    posTop = handleElem.position().top;

    handleElem.on('mousemove', dragging);
    handleElem.on('mouseup', stopped);
    handleElem.on('mouseleave', stopped);
  }

  cleanUp() {
    this.placeholder.find('.alert-handle-wrapper').remove();
    this.needsCleanup = false;
  }

  renderHandle(handleIndex: number, defaultHandleTopPos: number) {
    const model = this.thresholds[handleIndex];
    const value = model.value;
    let valueStr = value;
    let handleTopPos = 0;

    // handle no value
    if (!_.isNumber(value)) {
      valueStr = '';
      handleTopPos = defaultHandleTopPos;
    } else {
      const valueCanvasPos = this.plot.p2c({ x: 0, y: value });
      handleTopPos = Math.round(Math.min(Math.max(valueCanvasPos.top, 0), this.height) - 6);
    }

    const handleElem = $(this.getHandleHtml(handleIndex, model, valueStr));
    this.placeholder.append(handleElem);

    handleElem.toggleClass('alert-handle-wrapper--no-value', valueStr === '');
    handleElem.css({ top: handleTopPos });
  }

  shouldDrawHandles() {
    // @ts-ignore
    return !this.hasSecondYAxis && this.panelCtrl.editingThresholds && this.panelCtrl.panel.thresholds.length > 0;
  }

  prepare(elem: JQuery, data: any[]) {
    this.hasSecondYAxis = false;
    for (let i = 0; i < data.length; i++) {
      if (data[i].yaxis > 1) {
        this.hasSecondYAxis = true;
        break;
      }
    }

    if (this.shouldDrawHandles()) {
      const thresholdMargin = this.panelCtrl.panel.thresholds.length > 1 ? '220px' : '110px';
      elem.css('margin-right', thresholdMargin);
    } else if (this.needsCleanup) {
      elem.css('margin-right', '0');
    }
  }

  draw(plot: any) {
    this.thresholds = this.panelCtrl.panel.thresholds;
    this.plot = plot;
    this.placeholder = plot.getPlaceholder();

    if (this.needsCleanup) {
      this.cleanUp();
    }

    if (!this.shouldDrawHandles()) {
      return;
    }

    this.height = plot.height();

    if (this.thresholds.length > 0) {
      this.renderHandle(0, 10);
    }
    if (this.thresholds.length > 1) {
      this.renderHandle(1, this.height - 30);
    }

    this.placeholder.off('mousedown', '.alert-handle');
    this.placeholder.on('mousedown', '.alert-handle', this.initDragging.bind(this));
    this.needsCleanup = true;
  }

  addFlotOptions(options: any, panel: any) {
    if (!panel.thresholds || panel.thresholds.length === 0) {
      return;
    }

    let gtLimit = Infinity;
    let ltLimit = -Infinity;
    let i, threshold, other;

    for (i = 0; i < panel.thresholds.length; i++) {
      threshold = panel.thresholds[i];
      if (!_.isNumber(threshold.value)) {
        continue;
      }

      let limit;
      switch (threshold.op) {
        case 'gt': {
          limit = gtLimit;
          // if next threshold is less then op and greater value, then use that as limit
          if (panel.thresholds.length > i + 1) {
            other = panel.thresholds[i + 1];
            if (other.value > threshold.value) {
              limit = other.value;
              ltLimit = limit;
            }
          }
          break;
        }
        case 'lt': {
          limit = ltLimit;
          // if next threshold is less then op and greater value, then use that as limit
          if (panel.thresholds.length > i + 1) {
            other = panel.thresholds[i + 1];
            if (other.value < threshold.value) {
              limit = other.value;
              gtLimit = limit;
            }
          }
          break;
        }
      }

      let fillColor, lineColor;

      switch (threshold.colorMode) {
        case 'critical': {
          fillColor = 'rgba(234, 112, 112, 0.12)';
          lineColor = 'rgba(237, 46, 24, 0.60)';
          break;
        }
        case 'warning': {
          fillColor = 'rgba(235, 138, 14, 0.12)';
          lineColor = 'rgba(247, 149, 32, 0.60)';
          break;
        }
        case 'ok': {
          fillColor = 'rgba(11, 237, 50, 0.090)';
          lineColor = 'rgba(6,163,69, 0.60)';
          break;
        }
        case 'custom': {
          fillColor = threshold.fillColor;
          lineColor = threshold.lineColor;
          break;
        }
      }

      // fill
      if (threshold.fill) {
        if (threshold.yaxis === 'right' && this.hasSecondYAxis) {
          options.grid.markings.push({
            y2axis: { from: threshold.value, to: limit },
            color: getColorFromHexRgbOrName(fillColor),
          });
        } else {
          options.grid.markings.push({
            yaxis: { from: threshold.value, to: limit },
            color: getColorFromHexRgbOrName(fillColor),
          });
        }
      }
      if (threshold.line) {
        if (threshold.yaxis === 'right' && this.hasSecondYAxis) {
          options.grid.markings.push({
            y2axis: { from: threshold.value, to: threshold.value },
            color: getColorFromHexRgbOrName(lineColor),
          });
        } else {
          options.grid.markings.push({
            yaxis: { from: threshold.value, to: threshold.value },
            color: getColorFromHexRgbOrName(lineColor),
          });
        }
      }
    }
  }
}
