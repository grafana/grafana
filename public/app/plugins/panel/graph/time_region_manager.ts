import 'vendor/flot/jquery.flot';
import _ from 'lodash';
import moment from 'moment';
import config from 'app/core/config';

export const colorModes = {
  gray: {
    themeDependent: true,
    title: 'Gray',
    darkColor: { fill: 'rgba(255, 255, 255, 0.09)', line: 'rgba(255, 255, 255, 0.2)' },
    lightColor: { fill: 'rgba(0, 0, 0, 0.09)', line: 'rgba(0, 0, 0, 0.2)' },
  },
  red: {
    title: 'Red',
    color: { fill: 'rgba(234, 112, 112, 0.12)', line: 'rgba(237, 46, 24, 0.60)' },
  },
  green: {
    title: 'Green',
    color: { fill: 'rgba(11, 237, 50, 0.090)', line: 'rgba(6,163,69, 0.60)' },
  },
  blue: {
    title: 'Blue',
    color: { fill: 'rgba(11, 125, 238, 0.12)', line: 'rgba(11, 125, 238, 0.60)' },
  },
  yellow: {
    title: 'Yellow',
    color: { fill: 'rgba(235, 138, 14, 0.12)', line: 'rgba(247, 149, 32, 0.60)' },
  },
  custom: { title: 'Custom' },
};

export function getColorModes() {
  return _.map(Object.keys(colorModes), key => {
    return {
      key: key,
      value: colorModes[key].title,
    };
  });
}

function getColor(timeRegion) {
  if (Object.keys(colorModes).indexOf(timeRegion.colorMode) === -1) {
    timeRegion.colorMode = 'red';
  }

  if (timeRegion.colorMode === 'custom') {
    return {
      fill: timeRegion.fillColor,
      line: timeRegion.lineColor,
    };
  }

  const colorMode = colorModes[timeRegion.colorMode];
  if (colorMode.themeDependent === true) {
    return config.bootData.user.lightTheme ? colorMode.lightColor : colorMode.darkColor;
  }

  return colorMode.color;
}

export class TimeRegionManager {
  plot: any;
  timeRegions: any;

  constructor(private panelCtrl) {}

  draw(plot) {
    this.timeRegions = this.panelCtrl.panel.timeRegions;
    this.plot = plot;
  }

  addFlotOptions(options, panel) {
    if (!panel.timeRegions || panel.timeRegions.length === 0) {
      return;
    }

    const tRange = { from: moment(this.panelCtrl.range.from).utc(), to: moment(this.panelCtrl.range.to).utc() };

    let i, hRange, timeRegion, regions, fromStart, fromEnd, timeRegionColor;

    const timeRegionsCopy = panel.timeRegions.map(a => ({ ...a }));

    for (i = 0; i < timeRegionsCopy.length; i++) {
      timeRegion = timeRegionsCopy[i];

      if (!(timeRegion.fromDayOfWeek || timeRegion.from) && !(timeRegion.toDayOfWeek || timeRegion.to)) {
        continue;
      }

      if (timeRegion.from && !timeRegion.to) {
        timeRegion.to = timeRegion.from;
      }

      if (!timeRegion.from && timeRegion.to) {
        timeRegion.from = timeRegion.to;
      }

      hRange = {
        from: this.parseTimeRange(timeRegion.from),
        to: this.parseTimeRange(timeRegion.to),
      };

      if (!timeRegion.fromDayOfWeek && timeRegion.toDayOfWeek) {
        timeRegion.fromDayOfWeek = timeRegion.toDayOfWeek;
      }

      if (!timeRegion.toDayOfWeek && timeRegion.fromDayOfWeek) {
        timeRegion.toDayOfWeek = timeRegion.fromDayOfWeek;
      }

      if (timeRegion.fromDayOfWeek) {
        hRange.from.dayOfWeek = Number(timeRegion.fromDayOfWeek);
      }

      if (timeRegion.toDayOfWeek) {
        hRange.to.dayOfWeek = Number(timeRegion.toDayOfWeek);
      }

      if (hRange.from.dayOfWeek && hRange.from.h === null && hRange.from.m === null) {
        hRange.from.h = 0;
        hRange.from.m = 0;
        hRange.from.s = 0;
      }

      if (hRange.to.dayOfWeek && hRange.to.h === null && hRange.to.m === null) {
        hRange.to.h = 23;
        hRange.to.m = 59;
        hRange.to.s = 59;
      }

      if (!hRange.from || !hRange.to) {
        continue;
      }

      regions = [];

      if (
        hRange.from.h >= tRange.from.hour() &&
        hRange.from.h <= tRange.from.hour() &&
        hRange.from.m >= tRange.from.minute() &&
        hRange.from.m <= tRange.from.minute() &&
        hRange.to.h >= tRange.to.hour() &&
        hRange.to.h <= tRange.to.hour() &&
        hRange.to.m >= tRange.to.minute() &&
        hRange.to.m <= tRange.to.minute()
      ) {
        regions.push({ from: tRange.from.valueOf(), to: tRange.to.startOf('hour').valueOf() });
      } else {
        fromStart = moment(tRange.from);
        fromStart.set('hour', 0);
        fromStart.set('minute', 0);
        fromStart.set('second', 0);
        fromStart.add(hRange.from.h, 'hours');
        fromStart.add(hRange.from.m, 'minutes');
        fromStart.add(hRange.from.s, 'seconds');

        while (fromStart.unix() <= tRange.to.unix()) {
          while (hRange.from.dayOfWeek && hRange.from.dayOfWeek !== fromStart.isoWeekday()) {
            fromStart.add(24, 'hours');
          }

          if (fromStart.unix() > tRange.to.unix()) {
            break;
          }

          fromEnd = moment(fromStart);

          if (hRange.from.h <= hRange.to.h) {
            fromEnd.add(hRange.to.h - hRange.from.h, 'hours');
          } else if (hRange.from.h + hRange.to.h < 23) {
            fromEnd.add(hRange.to.h, 'hours');

            while (fromEnd.hour() !== hRange.to.h) {
              fromEnd.add(-1, 'hours');
            }
          } else {
            fromEnd.add(24 - hRange.from.h, 'hours');

            while (fromEnd.hour() !== hRange.to.h) {
              fromEnd.add(1, 'hours');
            }
          }

          fromEnd.set('minute', hRange.to.m);
          fromEnd.set('second', hRange.to.s);

          while (hRange.to.dayOfWeek && hRange.to.dayOfWeek !== fromEnd.isoWeekday()) {
            fromEnd.add(24, 'hours');
          }

          const outsideRange =
            (fromStart.unix() < tRange.from.unix() && fromEnd.unix() < tRange.from.unix()) ||
            (fromStart.unix() > tRange.to.unix() && fromEnd.unix() > tRange.to.unix());

          if (!outsideRange) {
            regions.push({ from: fromStart.valueOf(), to: fromEnd.valueOf() });
          }

          fromStart.add(24, 'hours');
        }
      }

      timeRegionColor = getColor(timeRegion);

      for (let j = 0; j < regions.length; j++) {
        const r = regions[j];
        if (timeRegion.fill) {
          options.grid.markings.push({
            xaxis: { from: r.from, to: r.to },
            color: timeRegionColor.fill,
          });
        }

        if (timeRegion.line) {
          options.grid.markings.push({
            xaxis: { from: r.from, to: r.from },
            color: timeRegionColor.line,
          });
          options.grid.markings.push({
            xaxis: { from: r.to, to: r.to },
            color: timeRegionColor.line,
          });
        }
      }
    }
  }

  parseTimeRange(str) {
    const timeRegex = /^([\d]+):?(\d{2})?/;
    const result = { h: null, m: null };
    const match = timeRegex.exec(str);

    if (!match) {
      return result;
    }

    if (match.length > 1) {
      result.h = Number(match[1]);
      result.m = 0;

      if (match.length > 2 && match[2] !== undefined) {
        result.m = Number(match[2]);
      }

      if (result.h > 23) {
        result.h = 23;
      }

      if (result.m > 59) {
        result.m = 59;
      }
    }

    return result;
  }
}
