import { each, map, includes, flatten, keys } from 'lodash';
import TableModel from 'app/core/table_model';
import { FieldType, QueryResultMeta, TimeSeries, TableData } from '@grafana/data';

function subst(instr:string): string {
  var instr_idx = 0;
  var instr_oldidx: number;

  // get next character; on end-of-string, return null if no msg given, throw otherwise
  function nextch(msg: string): string | null {
    instr_oldidx = instr_idx;
    // rather convoluted in order to handle Code Points not fitting in 16 bits
    var cp = instr.codePointAt(instr_idx);
    if (cp == undefined) {
      if (msg == "")
        return null;
      else
        throw "EOF in " + msg;
    }
    var ch = String.fromCodePoint(cp);
    instr_idx += ch.length;
    return ch;
  }

  function prevch() {
    instr_idx = instr_oldidx;
  }

  var out = "";
  for (;;) {
    let left, mid, right: string;
    let ch = nextch("");
    if (ch == null) {
      break;
    } else if (ch == "$") {
      left = nextch("after $");
      switch (left) {
      case "/":
        mid = "/"; right = "/";
        break;
      case "(":
        mid = "|"; right = ")";
        break;
      case "[":
        mid = "|"; right = "]";
        break;
      case "{":
        mid = "|"; right = "}";
        break;
      case "$":
        out += "$";
        continue;
      default:
        out += (ch + left);
        continue;
      }
    } else {
      out += ch;
      continue;
    }
    let more = true; // more substitutions in same command
    let matched = false; // had a match so far
    while (more) {
      // parse search (RE) part
      let srch = "";
      for (;;) {
        let ch = nextch("RE");
        if (ch == "\\") {
          srch += nextch("escape sequence in RE");
        } else if (ch == mid) {
          break;
        } else if (ch == right) {
          throw "missing replace part";
        } else {
          srch += ch;
        }
      }
      let re: RegExp;
      try {
        re = new RegExp(srch, "g");
      } catch (err) {
        throw "invalid RE " + srch + ": " + err;
      }
      // parse replace part
      let repl = "";
      let backref = false; // replace part possibly contains backreferences
      for (;;) {
        let ch = nextch("replace");
        if (ch == "\\") {
          repl += nextch("escape sequence in replace");
        } else if (ch == right) {
          break;
        } else if (ch == "$") {
          backref = true;
          repl += "$";
        } else {
          repl += ch;
        }
      }

      // check if more substitutions follow in order to speed up code below
      let ch = nextch("");
      if (ch == null) {
        more = false;
      } else if (ch != left) {
        prevch();
        more = false;
      }

      // there's no easy way to replace() with backreferences and log whether a replacement took place
      if (matched) {
        // already matched something, skip this
      } else if (!more) {
        // last replacement in command; no need to find out whether a replacement actually occured
        out = out.replace(re, repl);
      } else if (!backref) {
        // no backreferences, use a replace function to log whether a replacement occured
        out = out.replace(re, function() {
          matched = true;
          return repl;
        });
      } else {
        // possible backreferences, use match() to find out whether replacements occured
        if (out.match(re)) {
          matched = true;
          out = out.replace(re, repl);
        }
      }
    }
  }

  return out;
}

export default class InfluxSeries {
  refId?: string;
  series: any;
  alias: any;
  annotation: any;
  meta?: QueryResultMeta;

  constructor(options: { series: any; alias?: any; annotation?: any; meta?: QueryResultMeta; refId?: string }) {
    this.series = options.series;
    this.alias = options.alias;
    this.annotation = options.annotation;
    this.meta = options.meta;
    this.refId = options.refId;
  }

  getTimeSeries(): TimeSeries[] {
    const output: TimeSeries[] = [];
    let i, j;

    if (this.series.length === 0) {
      return output;
    }

    each(this.series, (series) => {
      const columns = series.columns.length;
      const tags = map(series.tags, (value, key) => {
        return key + ': ' + value;
      });

      for (j = 1; j < columns; j++) {
        let seriesName = series.name;
        const columnName = series.columns[j];
        if (columnName !== 'value') {
          seriesName = seriesName + '.' + columnName;
        }

        if (this.alias) {
          seriesName = this._getSeriesName(series, j);
        } else if (series.tags) {
          seriesName = seriesName + ' {' + tags.join(', ') + '}';
        }

        const datapoints = [];
        if (series.values) {
          for (i = 0; i < series.values.length; i++) {
            datapoints[i] = [series.values[i][j], series.values[i][0]];
          }
        }

        output.push({ target: seriesName, datapoints: datapoints, meta: this.meta, refId: this.refId });
      }
    });

    return output;
  }

  _getSeriesName(series: any, index: number) {
    const regex = /\$(\$|\w+)|\[\[([\s\S]+?)\]\]/g;
    const segments = series.name.split('.');

    var ret = this.alias.replace(regex, (match: any, g1: any, g2: any) => {
      const group = g1 || g2;
      const segIndex = parseInt(group, 10);

      if (group === '$') {
        return '$';
      }
      if (group === 'm' || group === 'measurement') {
        return series.name;
      }
      if (group === 'col') {
        return series.columns[index];
      }
      if (!isNaN(segIndex)) {
        return segments[segIndex];
      }
      if (group.indexOf('tag_') !== 0) {
        return match;
      }

      const tag = group.replace('tag_', '');
      if (!series.tags) {
        return match;
      }
      return series.tags[tag];
    });

    try {
      let ret1 = subst(ret);
      return ret1;
    } catch (err) {
      return ret;
    }
  }

  getAnnotations() {
    const list: any[] = [];

    each(this.series, (series) => {
      let titleCol: any = null;
      let timeCol: any = null;
      let timeEndCol: any = null;
      const tagsCol: any = [];
      let textCol: any = null;

      each(series.columns, (column, index) => {
        if (column === 'time') {
          timeCol = index;
          return;
        }
        if (column === 'sequence_number') {
          return;
        }
        if (column === this.annotation.titleColumn) {
          titleCol = index;
          return;
        }
        if (includes((this.annotation.tagsColumn || '').replace(' ', '').split(','), column)) {
          tagsCol.push(index);
          return;
        }
        if (column === this.annotation.textColumn) {
          textCol = index;
          return;
        }
        if (column === this.annotation.timeEndColumn) {
          timeEndCol = index;
          return;
        }
        // legacy case
        if (!titleCol && textCol !== index) {
          titleCol = index;
        }
      });

      each(series.values, (value) => {
        const data = {
          annotation: this.annotation,
          time: +new Date(value[timeCol]),
          title: value[titleCol],
          timeEnd: value[timeEndCol],
          // Remove empty values, then split in different tags for comma separated values
          tags: flatten(
            tagsCol
              .filter((t: any) => {
                return value[t];
              })
              .map((t: any) => {
                return value[t].split(',');
              })
          ),
          text: value[textCol],
        };

        list.push(data);
      });
    });

    return list;
  }

  getTable(): TableData {
    const table = new TableModel();
    let i, j;

    table.refId = this.refId;
    table.meta = this.meta;

    if (this.series.length === 0) {
      return table;
    }

    each(this.series, (series: any, seriesIndex: number) => {
      if (seriesIndex === 0) {
        j = 0;
        // Check that the first column is indeed 'time'
        if (series.columns[0] === 'time') {
          // Push this now before the tags and with the right type
          table.columns.push({ text: 'Time', type: FieldType.time });
          j++;
        }
        each(keys(series.tags), (key) => {
          table.columns.push({ text: key });
        });
        for (; j < series.columns.length; j++) {
          table.columns.push({ text: series.columns[j] });
        }
      }

      if (series.values) {
        for (i = 0; i < series.values.length; i++) {
          const values = series.values[i];
          const reordered = [values[0]];
          if (series.tags) {
            for (const key in series.tags) {
              if (series.tags.hasOwnProperty(key)) {
                reordered.push(series.tags[key]);
              }
            }
          }
          for (j = 1; j < values.length; j++) {
            reordered.push(values[j]);
          }
          table.rows.push(reordered);
        }
      }
    });

    return table;
  }
}
