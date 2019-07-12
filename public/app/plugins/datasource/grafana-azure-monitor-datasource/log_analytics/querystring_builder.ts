import { dateTime } from '@grafana/data';

export default class LogAnalyticsQuerystringBuilder {
  constructor(public rawQueryString: string, public options: any, public defaultTimeField: any) {}

  generate() {
    let queryString = this.rawQueryString;
    const macroRegexp = /\$__([_a-zA-Z0-9]+)\(([^\)]*)\)/gi;
    queryString = queryString.replace(macroRegexp, (match, p1, p2) => {
      if (p1 === 'contains') {
        return this.getMultiContains(p2);
      }

      return match;
    });

    queryString = queryString.replace(/\$__escapeMulti\(('[^]*')\)/gi, (match, p1) => this.escape(p1));

    if (this.options) {
      queryString = queryString.replace(macroRegexp, (match, p1, p2) => {
        if (p1 === 'timeFilter') {
          return this.getTimeFilter(p2, this.options);
        }
        if (p1 === 'timeFrom') {
          return this.getFrom(this.options);
        }
        if (p1 === 'timeTo') {
          return this.getUntil(this.options);
        }

        return match;
      });
      queryString = queryString.replace(/\$__interval/gi, this.options.interval);
    }
    const rawQuery = queryString;
    queryString = encodeURIComponent(queryString);
    const uriString = `query=${queryString}`;

    return { uriString, rawQuery };
  }

  getFrom(options: any) {
    const from = options.range.from;
    return `datetime(${dateTime(from)
      .startOf('minute')
      .toISOString()})`;
  }

  getUntil(options: any) {
    if (options.rangeRaw.to === 'now') {
      const now = Date.now();
      return `datetime(${dateTime(now)
        .startOf('minute')
        .toISOString()})`;
    } else {
      const until = options.range.to;
      return `datetime(${dateTime(until)
        .startOf('minute')
        .toISOString()})`;
    }
  }

  getTimeFilter(timeFieldArg: any, options: any) {
    const timeField = timeFieldArg || this.defaultTimeField;
    if (options.rangeRaw.to === 'now') {
      return `${timeField} >= ${this.getFrom(options)}`;
    } else {
      return `${timeField}  >= ${this.getFrom(options)} and ${timeField} <= ${this.getUntil(options)}`;
    }
  }

  getMultiContains(inputs: string) {
    const firstCommaIndex = inputs.indexOf(',');
    const field = inputs.substring(0, firstCommaIndex);
    const templateVar = inputs.substring(inputs.indexOf(',') + 1);

    if (templateVar && templateVar.toLowerCase().trim() === 'all') {
      return '1 == 1';
    }

    return `${field.trim()} in (${templateVar.trim()})`;
  }

  escape(inputs: string) {
    return inputs
      .substring(1, inputs.length - 1)
      .split(`','`)
      .map(v => `@'${v}'`)
      .join(', ');
  }
}
