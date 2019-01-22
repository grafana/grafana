import angular from 'angular';
import $ from 'jquery';
import _ from 'lodash';
import Drop from 'tether-drop';

/** @ngInject */
export function createAnnotationToolip(element, event, plot) {
  const injector = angular.element(document).injector();
  const content = document.createElement('div');
  content.innerHTML = '<annotation-tooltip event="event" on-edit="onEdit()"></annotation-tooltip>';

  injector.invoke([
    '$compile',
    '$rootScope',
    ($compile, $rootScope) => {
      const eventManager = plot.getOptions().events.manager;
      const tmpScope = $rootScope.$new(true);
      tmpScope.event = event;
      tmpScope.onEdit = () => {
        eventManager.editEvent(event);
      };

      $compile(content)(tmpScope);
      tmpScope.$digest();
      tmpScope.$destroy();

      const drop = new Drop({
        target: element[0],
        content: content,
        position: 'bottom center',
        classes: 'drop-popover drop-popover--annotation',
        openOn: 'hover',
        hoverCloseDelay: 200,
        tetherOptions: {
          constraints: [{ to: 'window', pin: true, attachment: 'both' }],
        },
      });

      drop.open();

      drop.on('close', () => {
        setTimeout(() => {
          drop.destroy();
        });
      });
    },
  ]);
}

let markerElementToAttachTo = null;

/** @ngInject */
export function createEditPopover(element, event, plot) {
  const eventManager = plot.getOptions().events.manager;
  if (eventManager.editorOpen) {
    // update marker element to attach to (needed in case of legend on the right
    // when there is a double render pass and the initial marker element is removed)
    markerElementToAttachTo = element;
    return;
  }

  // mark as openend
  eventManager.editorOpened();
  // set marker elment to attache to
  markerElementToAttachTo = element;

  // wait for element to be attached and positioned
  setTimeout(() => {
    const injector = angular.element(document).injector();
    const content = document.createElement('div');
    content.innerHTML = '<event-editor panel-ctrl="panelCtrl" event="event" close="close()"></event-editor>';

    injector.invoke([
      '$compile',
      '$rootScope',
      ($compile, $rootScope) => {
        const scope = $rootScope.$new(true);
        let drop;

        scope.event = event;
        scope.panelCtrl = eventManager.panelCtrl;
        scope.close = () => {
          drop.close();
        };

        $compile(content)(scope);
        scope.$digest();

        drop = new Drop({
          target: markerElementToAttachTo[0],
          content: content,
          position: 'bottom center',
          classes: 'drop-popover drop-popover--form',
          openOn: 'click',
          tetherOptions: {
            constraints: [{ to: 'window', pin: true, attachment: 'both' }],
          },
        });

        drop.open();
        eventManager.editorOpened();

        drop.on('close', () => {
          // need timeout here in order call drop.destroy
          setTimeout(() => {
            eventManager.editorClosed();
            scope.$destroy();
            drop.destroy();
          });
        });
      },
    ]);
  }, 100);
}

/*
 * jquery.flot.events
 *
 * description: Flot plugin for adding events/markers to the plot
 * version: 0.2.5
 * authors:
 *    Alexander Wunschik <alex@wunschik.net>
 *    Joel Oughton <joeloughton@gmail.com>
 *    Nicolas Joseph <www.nicolasjoseph.com>
 *
 * website: https://github.com/mojoaxel/flot-events
 *
 * released under MIT License and GPLv2+
 */

/**
 * A class that allows for the drawing an remove of some object
 */
export class DrawableEvent {
  _object: any;
  _drawFunc: any;
  _clearFunc: any;
  _moveFunc: any;
  _position: any;
  _width: any;
  _height: any;

  /** @ngInject */
  constructor(object, drawFunc, clearFunc, moveFunc, left, top, width, height) {
    this._object = object;
    this._drawFunc = drawFunc;
    this._clearFunc = clearFunc;
    this._moveFunc = moveFunc;
    this._position = { left: left, top: top };
    this._width = width;
    this._height = height;
  }

  width() {
    return this._width;
  }
  height() {
    return this._height;
  }
  position() {
    return this._position;
  }
  draw() {
    this._drawFunc(this._object);
  }
  clear() {
    this._clearFunc(this._object);
  }
  getObject() {
    return this._object;
  }
  moveTo(position) {
    this._position = position;
    this._moveFunc(this._object, this._position);
  }
}

/**
 * Event class that stores options (eventType, min, max, title, description) and the object to draw.
 */
export class VisualEvent {
  _parent: any;
  _options: any;
  _drawableEvent: any;
  _hidden: any;

  /** @ngInject */
  constructor(options, drawableEvent) {
    this._options = options;
    this._drawableEvent = drawableEvent;
    this._hidden = false;
  }

  visual() {
    return this._drawableEvent;
  }
  getOptions() {
    return this._options;
  }
  getParent() {
    return this._parent;
  }
  isHidden() {
    return this._hidden;
  }
  hide() {
    this._hidden = true;
  }
  unhide() {
    this._hidden = false;
  }
}

/**
 * A Class that handles the event-markers inside the given plot
 */
export class EventMarkers {
  _events: any;
  _types: any;
  _plot: any;
  eventsEnabled: any;

  /** @ngInject */
  constructor(plot) {
    this._events = [];
    this._types = [];
    this._plot = plot;
    this.eventsEnabled = false;
  }

  getEvents() {
    return this._events;
  }

  setTypes(types) {
    return (this._types = types);
  }

  /**
   * create internal objects for the given events
   */
  setupEvents(events) {
    const parts = _.partition(events, 'isRegion');
    const regions = parts[0];
    events = parts[1];

    $.each(events, (index, event) => {
      const ve = new VisualEvent(event, this._buildDiv(event));
      this._events.push(ve);
    });

    $.each(regions, (index, event) => {
      const vre = new VisualEvent(event, this._buildRegDiv(event));
      this._events.push(vre);
    });

    this._events.sort((a, b) => {
      const ao = a.getOptions(),
        bo = b.getOptions();
      if (ao.min > bo.min) {
        return 1;
      }
      if (ao.min < bo.min) {
        return -1;
      }
      return 0;
    });
  }

  /**
   * draw the events to the plot
   */
  drawEvents() {
    // var o = this._plot.getPlotOffset();

    $.each(this._events, (index, event) => {
      // check event is inside the graph range
      if (this._insidePlot(event.getOptions().min) && !event.isHidden()) {
        event.visual().draw();
      } else {
        event
          .visual()
          .getObject()
          .hide();
      }
    });
  }

  /**
   * update the position of the event-markers (e.g. after scrolling or zooming)
   */
  updateEvents() {
    const o = this._plot.getPlotOffset();
    let left;
    let top;
    const xaxis = this._plot.getXAxes()[this._plot.getOptions().events.xaxis - 1];

    $.each(this._events, (index, event) => {
      top = o.top + this._plot.height() - event.visual().height();
      left = xaxis.p2c(event.getOptions().min) + o.left - event.visual().width() / 2;
      event.visual().moveTo({ top: top, left: left });
    });
  }

  /**
   * remove all events from the plot
   */
  _clearEvents() {
    $.each(this._events, (index, val) => {
      val.visual().clear();
    });
    this._events = [];
  }

  /**
   * create a DOM element for the given event
   */
  _buildDiv(event) {
    const that = this;

    const container = this._plot.getPlaceholder();
    const o = this._plot.getPlotOffset();
    const xaxis = this._plot.getXAxes()[this._plot.getOptions().events.xaxis - 1];
    let top, left, color, markerSize, markerShow, lineStyle, lineWidth;
    let markerTooltip;

    // map the eventType to a types object
    const eventTypeId = event.eventType;

    if (this._types === null || !this._types[eventTypeId] || !this._types[eventTypeId].color) {
      color = '#666';
    } else {
      color = this._types[eventTypeId].color;
    }

    if (this._types === null || !this._types[eventTypeId] || !this._types[eventTypeId].markerSize) {
      markerSize = 8; //default marker size
    } else {
      markerSize = this._types[eventTypeId].markerSize;
    }

    if (this._types === null || !this._types[eventTypeId] || this._types[eventTypeId].markerShow === undefined) {
      markerShow = true;
    } else {
      markerShow = this._types[eventTypeId].markerShow;
    }

    if (this._types === null || !this._types[eventTypeId] || this._types[eventTypeId].markerTooltip === undefined) {
      markerTooltip = true;
    } else {
      markerTooltip = this._types[eventTypeId].markerTooltip;
    }

    if (this._types == null || !this._types[eventTypeId] || !this._types[eventTypeId].lineStyle) {
      lineStyle = 'dashed'; //default line style
    } else {
      lineStyle = this._types[eventTypeId].lineStyle.toLowerCase();
    }

    if (this._types == null || !this._types[eventTypeId] || this._types[eventTypeId].lineWidth === undefined) {
      lineWidth = 1; //default line width
    } else {
      lineWidth = this._types[eventTypeId].lineWidth;
    }

    let topOffset = xaxis.options.eventSectionHeight || 0;
    topOffset = topOffset / 3;

    top = o.top + this._plot.height() + topOffset;
    left = xaxis.p2c(event.min) + o.left;

    const line = $('<div class="events_line flot-temp-elem"></div>')
      .css({
        position: 'absolute',
        opacity: 0.8,
        left: left + 'px',
        top: 8,
        width: lineWidth + 'px',
        height: this._plot.height() + topOffset * 0.8,
        'border-left-width': lineWidth + 'px',
        'border-left-style': lineStyle,
        'border-left-color': color,
        color: color,
      })
      .appendTo(container);

    if (markerShow) {
      const marker = $('<div class="events_marker"></div>').css({
        position: 'absolute',
        left: -markerSize - Math.round(lineWidth / 2) + 'px',
        'font-size': 0,
        'line-height': 0,
        width: 0,
        height: 0,
        'border-left': markerSize + 'px solid transparent',
        'border-right': markerSize + 'px solid transparent',
      });

      marker.appendTo(line);

      if (
        this._types[eventTypeId] &&
        this._types[eventTypeId].position &&
        this._types[eventTypeId].position.toUpperCase() === 'BOTTOM'
      ) {
        marker.css({
          top: top - markerSize - 8 + 'px',
          'border-top': 'none',
          'border-bottom': markerSize + 'px solid ' + color,
        });
      } else {
        marker.css({
          top: '0px',
          'border-top': markerSize + 'px solid ' + color,
          'border-bottom': 'none',
        });
      }

      marker.data({
        event: event,
      });

      const mouseenter = function(this: any) {
        createAnnotationToolip(marker, $(this).data('event'), that._plot);
      };

      if (event.editModel) {
        createEditPopover(marker, event.editModel, that._plot);
      }

      const mouseleave = () => {
        that._plot.clearSelection();
      };

      if (markerTooltip) {
        marker.css({ cursor: 'help' });
        marker.hover(mouseenter, mouseleave);
      }
    }

    const drawableEvent = new DrawableEvent(
      line,
      function drawFunc(obj) {
        obj.show();
      },
      obj => {
        obj.remove();
      },
      (obj, position) => {
        obj.css({
          top: position.top,
          left: position.left,
        });
      },
      left,
      top,
      line.width(),
      line.height()
    );

    return drawableEvent;
  }

  /**
   * create a DOM element for the given region
   */
  _buildRegDiv(event) {
    const that = this;

    const container = this._plot.getPlaceholder();
    const o = this._plot.getPlotOffset();
    const xaxis = this._plot.getXAxes()[this._plot.getOptions().events.xaxis - 1];
    let top, left, lineWidth, regionWidth, lineStyle, color, markerTooltip;

    // map the eventType to a types object
    const eventTypeId = event.eventType;

    if (this._types === null || !this._types[eventTypeId] || !this._types[eventTypeId].color) {
      color = '#666';
    } else {
      color = this._types[eventTypeId].color;
    }

    if (this._types === null || !this._types[eventTypeId] || this._types[eventTypeId].markerTooltip === undefined) {
      markerTooltip = true;
    } else {
      markerTooltip = this._types[eventTypeId].markerTooltip;
    }

    if (this._types == null || !this._types[eventTypeId] || this._types[eventTypeId].lineWidth === undefined) {
      lineWidth = 1; //default line width
    } else {
      lineWidth = this._types[eventTypeId].lineWidth;
    }

    if (this._types == null || !this._types[eventTypeId] || !this._types[eventTypeId].lineStyle) {
      lineStyle = 'dashed'; //default line style
    } else {
      lineStyle = this._types[eventTypeId].lineStyle.toLowerCase();
    }

    const topOffset = 2;
    top = o.top + this._plot.height() + topOffset;

    const timeFrom = Math.min(event.min, event.timeEnd);
    const timeTo = Math.max(event.min, event.timeEnd);
    left = xaxis.p2c(timeFrom) + o.left;
    const right = xaxis.p2c(timeTo) + o.left;
    regionWidth = right - left;

    _.each([left, right], position => {
      const line = $('<div class="events_line flot-temp-elem"></div>').css({
        position: 'absolute',
        opacity: 0.8,
        left: position + 'px',
        top: 8,
        width: lineWidth + 'px',
        height: this._plot.height() + topOffset,
        'border-left-width': lineWidth + 'px',
        'border-left-style': lineStyle,
        'border-left-color': color,
        color: color,
      });
      line.appendTo(container);
    });

    const region = $('<div class="events_marker region_marker flot-temp-elem"></div>').css({
      position: 'absolute',
      opacity: 0.5,
      left: left + 'px',
      top: top,
      width: Math.round(regionWidth + lineWidth) + 'px',
      height: '0.5rem',
      'border-left-color': color,
      color: color,
      'background-color': color,
    });
    region.appendTo(container);

    region.data({
      event: event,
    });

    const mouseenter = function(this: any) {
      createAnnotationToolip(region, $(this).data('event'), that._plot);
    };

    if (event.editModel) {
      createEditPopover(region, event.editModel, that._plot);
    }

    const mouseleave = () => {
      that._plot.clearSelection();
    };

    if (markerTooltip) {
      region.css({ cursor: 'help' });
      region.hover(mouseenter, mouseleave);
    }

    const drawableEvent = new DrawableEvent(
      region,
      function drawFunc(obj) {
        obj.show();
      },
      obj => {
        obj.remove();
      },
      (obj, position) => {
        obj.css({
          top: position.top,
          left: position.left,
        });
      },
      left,
      top,
      region.width(),
      region.height()
    );

    return drawableEvent;
  }

  /**
   * check if the event is inside visible range
   */
  _insidePlot(x) {
    const xaxis = this._plot.getXAxes()[this._plot.getOptions().events.xaxis - 1];
    const xc = xaxis.p2c(x);
    return xc > 0 && xc < xaxis.p2c(xaxis.max);
  }
}

/**
 * initialize the plugin for the given plot
 */

/** @ngInject */
export function init(this: any, plot) {
  /*jshint validthis:true */
  const that = this;
  const eventMarkers = new EventMarkers(plot);

  plot.getEvents = () => {
    return eventMarkers._events;
  };

  plot.hideEvents = () => {
    $.each(eventMarkers._events, (index, event) => {
      event
        .visual()
        .getObject()
        .hide();
    });
  };

  plot.showEvents = () => {
    plot.hideEvents();
    $.each(eventMarkers._events, (index, event) => {
      event.hide();
    });

    that.eventMarkers.drawEvents();
  };

  // change events on an existing plot
  plot.setEvents = events => {
    if (eventMarkers.eventsEnabled) {
      eventMarkers.setupEvents(events);
    }
  };

  plot.hooks.processOptions.push((plot, options) => {
    // enable the plugin
    if (options.events.data != null) {
      eventMarkers.eventsEnabled = true;
    }
  });

  plot.hooks.draw.push(plot => {
    const options = plot.getOptions();

    if (eventMarkers.eventsEnabled) {
      // check for first run
      if (eventMarkers.getEvents().length < 1) {
        eventMarkers.setTypes(options.events.types);
        eventMarkers.setupEvents(options.events.data);
      } else {
        eventMarkers.updateEvents();
      }
    }

    eventMarkers.drawEvents();
  });
}

const defaultOptions = {
  events: {
    data: null,
    types: null,
    xaxis: 1,
    position: 'BOTTOM',
  },
};

$.plot.plugins.push({
  init: init,
  options: defaultOptions,
  name: 'events',
  version: '0.2.5',
});
