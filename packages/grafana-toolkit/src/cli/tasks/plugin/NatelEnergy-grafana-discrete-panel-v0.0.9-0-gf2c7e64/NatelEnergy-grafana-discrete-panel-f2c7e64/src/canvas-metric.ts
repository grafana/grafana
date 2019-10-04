import {MetricsPanelCtrl} from 'app/plugins/sdk';

import moment from 'moment';
import $ from 'jquery';

import appEvents from 'app/core/app_events';

// Expects a template with:
// <div class="canvas-spot"></div>
export class CanvasPanelCtrl extends MetricsPanelCtrl {
  data: any;
  mouse: any;
  $tooltip: any;
  wrap: any;
  canvas: any;
  context: any;
  _devicePixelRatio: number;

  /** @ngInject */
  constructor($scope, $injector) {
    super($scope, $injector);

    this.data = null;
    this.mouse = {
      position: null,
      down: null,
    };
    this.$tooltip = $('<div class="graph-tooltip">');

    this.events.on('panel-initialized', this.onPanelInitialized.bind(this));
    this.events.on('refresh', this.onRefresh.bind(this));
    this.events.on('render', this.onRender.bind(this));

    this._devicePixelRatio = 1;
    if (window.devicePixelRatio !== undefined) {
      this._devicePixelRatio = window.devicePixelRatio;
    }
  }

  onPanelInitialized() {
    //console.log("onPanelInitalized()");
    this.render();
  }

  onRefresh() {
    //console.log("onRefresh()");
    this.render();
  }

  // Typically you will override this
  onRender() {
    if (!this.context) {
      console.log('No context!');
      return;
    }
    console.log('canvas render', this.mouse);

    const rect = this.wrap.getBoundingClientRect();

    const height = Math.max(this.height, 100);
    const width = rect.width;
    this.canvas.width = width;
    this.canvas.height = height;

    const centerV = height / 2;

    const ctx = this.context;
    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';

    let time = '';
    if (this.mouse.position != null) {
      time = this.dashboard.formatDate(moment(this.mouse.position.ts));
    }

    ctx.fillStyle = '#999999';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#111111';
    ctx.font = '24px "Open Sans", Helvetica, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Mouse @ ' + time, 10, centerV);

    if (this.mouse.position != null) {
      if (this.mouse.down != null) {
        const xmin = Math.min(this.mouse.position.x, this.mouse.down.x);
        const xmax = Math.max(this.mouse.position.x, this.mouse.down.x);

        // Fill canvas using 'destination-out' and alpha at 0.05
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.beginPath();
        ctx.fillRect(0, 0, xmin, height);
        ctx.fill();

        ctx.beginPath();
        ctx.fillRect(xmax, 0, width, height);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.strokeStyle = '#111';
        ctx.beginPath();
        ctx.moveTo(this.mouse.position.x, 0);
        ctx.lineTo(this.mouse.position.x, height);
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(this.mouse.position.x, 0);
        ctx.lineTo(this.mouse.position.x, height);
        ctx.strokeStyle = '#e22c14';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  clearTT() {
    this.$tooltip.detach();
  }

  getMousePosition(evt) {
    const elapsed = this.range.to - this.range.from;
    const rect = this.canvas.getBoundingClientRect();
    const x = evt.offsetX; // - rect.left;
    const ts = this.range.from + elapsed * (x / parseFloat(rect.width));
    const y = evt.clientY - rect.top;

    return {
      x: x,
      y: y,
      yRel: y / parseFloat(rect.height),
      ts: ts,
      evt: evt,
    };
  }

  onGraphHover(evt, showTT, isExternal) {
    console.log('HOVER', evt, showTT, isExternal);
  }

  onMouseClicked(where, event) {
    console.log('CANVAS CLICKED', where, event);
    this.render();
  }

  onMouseSelectedRange(range, event) {
    console.log('CANVAS Range', range, event);
  }

  link(scope, elem, attrs, ctrl) {
    this.wrap = elem.find('.canvas-spot')[0];
    this.canvas = document.createElement('canvas');
    this.wrap.appendChild(this.canvas);

    $(this.canvas).css('cursor', 'pointer');
    $(this.wrap).css('width', '100%');

    //  console.log( 'link', this );

    this.context = this.canvas.getContext('2d');
    this.canvas.addEventListener(
      'mousemove',
      evt => {
        if (!this.range) {
          return; // skip events before we have loaded
        }

        this.mouse.position = this.getMousePosition(evt);
        const info = {
          pos: {
            pageX: evt.pageX,
            pageY: evt.pageY,
            x: this.mouse.position.ts,
            y: this.mouse.position.y,
            panelRelY: this.mouse.position.yRel,
            panelRelX: this.mouse.position.xRel,
          },
          evt: evt,
          panel: this.panel,
        };
        appEvents.emit('graph-hover', info);
        if (this.mouse.down != null) {
          $(this.canvas).css('cursor', 'col-resize');
        }
      },
      false
    );

    this.canvas.addEventListener(
      'mouseout',
      evt => {
        if (this.mouse.down == null) {
          this.mouse.position = null;
          this.onRender();
          this.$tooltip.detach();
          appEvents.emit('graph-hover-clear');
        }
      },
      false
    );

    this.canvas.addEventListener(
      'mousedown',
      evt => {
        this.mouse.down = this.getMousePosition(evt);
      },
      false
    );

    this.canvas.addEventListener(
      'mouseenter',
      evt => {
        if (this.mouse.down && !evt.buttons) {
          this.mouse.position = null;
          this.mouse.down = null;
          this.onRender();
          this.$tooltip.detach();
          appEvents.emit('graph-hover-clear');
        }
        $(this.canvas).css('cursor', 'pointer');
      },
      false
    );

    this.canvas.addEventListener(
      'mouseup',
      evt => {
        this.$tooltip.detach();
        const up = this.getMousePosition(evt);
        if (this.mouse.down != null) {
          if (up.x === this.mouse.down.x && up.y === this.mouse.down.y) {
            this.mouse.position = null;
            this.mouse.down = null;
            this.onMouseClicked(up, evt);
          } else {
            const min = Math.min(this.mouse.down.ts, up.ts);
            const max = Math.max(this.mouse.down.ts, up.ts);
            const range = {from: moment.utc(min), to: moment.utc(max)};
            this.mouse.position = up;
            this.onMouseSelectedRange(range, evt);
          }
        }
        this.mouse.down = null;
        this.mouse.position = null;
      },
      false
    );

    this.canvas.addEventListener(
      'dblclick',
      evt => {
        this.mouse.position = null;
        this.mouse.down = null;
        this.onRender();
        this.$tooltip.detach();
        appEvents.emit('graph-hover-clear');

        console.log('TODO, ZOOM OUT');
      },
      true
    );

    // global events
    appEvents.on(
      'graph-hover',
      event => {
        // ignore other graph hover events if shared tooltip is disabled
        const isThis = event.panel.id === this.panel.id;
        if (!this.dashboard.sharedTooltipModeEnabled() && !isThis) {
          return;
        }

        // ignore if other panels are fullscreen
        if (this.otherPanelInFullscreenMode()) {
          return;
        }

        // Calculate the mouse position when it came from somewhere else
        if (!isThis) {
          if (!event.pos.x || !this.range) {
            // NOTE, this happens when a panel has no data
            // console.log('Invalid hover point', event);
            return;
          }

          const ts = event.pos.x;
          const rect = this.canvas.getBoundingClientRect();
          const elapsed = this.range.to - this.range.from;
          const x = ((ts - this.range.from) / elapsed) * rect.width;

          this.mouse.position = {
            x: x,
            y: event.pos.panelRelY * rect.height,
            yRel: event.pos.panelRelY,
            ts: ts,
            gevt: event,
          };
          //console.log( "Calculate mouseInfo", event, this.mouse.position);
        }

        this.onGraphHover(
          event,
          isThis || !this.dashboard.sharedCrosshairModeOnly(),
          !isThis
        );
      },
      scope
    );

    appEvents.on(
      'graph-hover-clear',
      (event, info) => {
        this.mouse.position = null;
        this.mouse.down = null;
        this.render();
        this.$tooltip.detach();
      },
      scope
    );

    // scope.$on('$destroy', () => {
    //   this.$tooltip.destroy();
    //   elem.off();
    //   elem.remove();
    // });
  }

  // Utility Functions for time axis
  //---------------------------------

  time_format(range: number, secPerTick: number): string {
    const oneDay = 86400000;
    const oneYear = 31536000000;

    if (secPerTick <= 45) {
      return '%H:%M:%S';
    }
    if (secPerTick <= 7200 || range <= oneDay) {
      return '%H:%M';
    }
    if (secPerTick <= 80000) {
      return '%m/%d %H:%M';
    }
    if (secPerTick <= 2419200 || range <= oneYear) {
      return '%m/%d';
    }
    return '%Y-%m';
  }

  getTimeResolution(estTimeInterval: number): number {
    const timeIntInSecs = estTimeInterval / 1000;

    if (timeIntInSecs <= 30) {
      return 30 * 1000;
    }

    if (timeIntInSecs <= 60) {
      return 60 * 1000;
    }

    if (timeIntInSecs <= 60 * 5) {
      return 5 * 60 * 1000;
    }

    if (timeIntInSecs <= 60 * 10) {
      return 10 * 60 * 1000;
    }

    if (timeIntInSecs <= 60 * 30) {
      return 30 * 60 * 1000;
    }

    if (timeIntInSecs <= 60 * 60) {
      return 60 * 60 * 1000;
    }

    if (timeIntInSecs <= 60 * 60) {
      return 60 * 60 * 1000;
    }

    if (timeIntInSecs <= 2 * 60 * 60) {
      return 2 * 60 * 60 * 1000;
    }

    if (timeIntInSecs <= 6 * 60 * 60) {
      return 6 * 60 * 60 * 1000;
    }

    if (timeIntInSecs <= 12 * 60 * 60) {
      return 12 * 60 * 60 * 1000;
    }

    if (timeIntInSecs <= 24 * 60 * 60) {
      return 24 * 60 * 60 * 1000;
    }

    if (timeIntInSecs <= 2 * 24 * 60 * 60) {
      return 2 * 24 * 60 * 60 * 1000;
    }

    if (timeIntInSecs <= 7 * 24 * 60 * 60) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    if (timeIntInSecs <= 30 * 24 * 60 * 60) {
      return 30 * 24 * 60 * 60 * 1000;
    }

    return 6 * 30 * 24 * 60 * 60 * 1000;
  }

  roundDate(timeStamp, roundee) {
    timeStamp -= timeStamp % roundee; //subtract amount of time since midnight
    return timeStamp;
  }

  formatDate(d, fmt) {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (typeof d.strftime === 'function') {
      return d.strftime(fmt);
    }

    const r = [];
    let escape = false;
    const hours = d.getHours();
    const isAM = hours < 12;
    let hours12;

    if (hours > 12) {
      hours12 = hours - 12;
    } else if (hours === 0) {
      hours12 = 12;
    } else {
      hours12 = hours;
    }

    for (let i = 0; i < fmt.length; ++i) {
      let c = fmt.charAt(i);

      if (escape) {
        switch (c) {
          case 'a':
            c = '' + dayNames[d.getDay()];
            break;
          case 'b':
            c = '' + monthNames[d.getMonth()];
            break;
          case 'd':
            c = this.leftPad(d.getDate(), '');
            break;
          case 'e':
            c = this.leftPad(d.getDate(), ' ');
            break;
          case 'h': // For back-compat with 0.7; remove in 1.0
          case 'H':
            c = this.leftPad(hours, null);
            break;
          case 'I':
            c = this.leftPad(hours12, null);
            break;
          case 'l':
            c = this.leftPad(hours12, ' ');
            break;
          case 'm':
            c = this.leftPad(d.getMonth() + 1, '');
            break;
          case 'M':
            c = this.leftPad(d.getMinutes(), null);
            break;
          // quarters not in Open Group's strftime specification
          case 'q':
            c = '' + (Math.floor(d.getMonth() / 3) + 1);
            break;
          case 'S':
            c = this.leftPad(d.getSeconds(), null);
            break;
          case 'y':
            c = this.leftPad(d.getFullYear() % 100, null);
            break;
          case 'Y':
            c = '' + d.getFullYear();
            break;
          case 'p':
            c = isAM ? '' + 'am' : '' + 'pm';
            break;
          case 'P':
            c = isAM ? '' + 'AM' : '' + 'PM';
            break;
          case 'w':
            c = '' + d.getDay();
            break;
        }
        r.push(c);
        escape = false;
      } else {
        if (c === '%') {
          escape = true;
        } else {
          r.push(c);
        }
      }
    }

    return r.join('');
  }

  leftPad(n, pad) {
    n = '' + n;
    pad = '' + (pad == null ? '0' : pad);
    return n.length === 1 ? pad + n : n;
  }
}
