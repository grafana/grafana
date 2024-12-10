export interface AwsUrl {
  end: string;
  start: string;
  timeType?: 'ABSOLUTE' | 'RELATIVE';
  tz?: 'local' | 'UTC';
  unit?: string;
  editorString: string;
  isLiveTail: boolean;
  source: string[];
}

const defaultURL = 'console.aws.amazon.com';
const usGovURL = 'console.amazonaws-us-gov.com';
const chinaURL = 'console.amazonaws.cn';

export function getLogsEndpoint(region: string): string {
  let url = defaultURL;
  if (region.startsWith('us-gov-')) {
    url = usGovURL;
  }
  if (region.startsWith('cn-')) {
    url = chinaURL;
  }
  return `${region}.${url}`;
}

export function encodeUrl(obj: AwsUrl, region: string): string {
  return `https://${getLogsEndpoint(
    region
  )}/cloudwatch/home?region=${region}#logs-insights:queryDetail=${stringify(obj)}`;
}

// Lifted from https://github.com/Sage/jsurl
function stringify<T>(v: T): string {
  function encode(s: string): string {
    return !/[^\w-.]/.test(s)
      ? s
      : s.replace(/[^\w-.]/g, (ch: string): string => {
          if (ch === '$') {
            return '!';
          }
          const charCode = ch.charCodeAt(0);
          // Thanks to Douglas Crockford for the negative slice trick
          return charCode < 0x100
            ? '*' + ('00' + charCode.toString(16)).slice(-2)
            : '**' + ('0000' + charCode.toString(16)).slice(-4);
        });
  }

  let tmpAry;

  switch (typeof v) {
    case 'number':
      return isFinite(v) ? '~' + v : '~null';
    case 'boolean':
      return '~' + v;
    case 'string':
      return "~'" + encode(v);
    case 'object':
      if (!v) {
        return '~null';
      }

      tmpAry = [];

      if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
          tmpAry[i] = stringify(v[i]) || '~null';
        }

        return '~(' + (tmpAry.join('') || '~') + ')';
      } else {
        for (const key in v) {
          if (v.hasOwnProperty(key)) {
            const val = stringify(v[key]);

            // skip undefined and functions
            if (val) {
              tmpAry.push(encode(key) + val);
            }
          }
        }

        return '~(' + tmpAry.join('~') + ')';
      }
    default:
      // function, undefined
      return '';
  }
}
