import moment from 'moment';

export default class LogAnalyticsQuerystringBuilder {
  constructor(public rawQueryString, public options, public defaultTimeField) {}

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

        return match;
      });
      queryString = queryString.replace(/\$__interval/gi, this.options.interval);
      queryString = queryString.replace(/\$__from/gi, this.getFrom(this.options));
      queryString = queryString.replace(/\$__to/gi, this.getUntil(this.options));
    }
    const rawQuery = queryString;
    queryString = encodeURIComponent(queryString);
    const uriString = `query=${queryString}`;

    return { uriString, rawQuery };
  }

  getFrom(options) {
    const from = options.range.from;
    return `datetime(${moment(from)
      .startOf('minute')
      .toISOString()})`;
  }

  getUntil(options) {
    if (options.rangeRaw.to === 'now') {
      return 'now()';
    } else {
      const until = options.range.to;
      return `datetime(${moment(until)
        .startOf('minute')
        .toISOString()})`;
    }
  }

  getTimeFilter(timeFieldArg, options) {
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
