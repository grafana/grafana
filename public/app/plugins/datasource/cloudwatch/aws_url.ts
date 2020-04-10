function encodeString(str: string): string {
  //  'fields*20*40timestamps*2c*20*40message*0a*7c*20sort*20*40timestamp*20desc*0a*
  let newString = '';
  for (let i = 0; i < str.length; i++) {
    // 0x30 - 0x39, 0x41 - 0x5a, 0x61 - 0x7a
    // -_$.
    const charCode = str.charCodeAt(i);
    if (isAlphanumeric(charCode) || isSpecial(charCode)) {
      newString += str[i];
    } else {
      const asciiCompatible = charCode >> 8 === 0;
      newString += `${asciiCompatible ? '*' : '**'}${
        asciiCompatible ? charCode.toString(16) : charCode.toString(16).padStart(4, '0')
      }`;
    }
  }

  return newString;
}

function isAlphanumeric(charCode: number): boolean {
  return (
    (charCode >= 0x30 && charCode <= 0x39) ||
    (charCode >= 0x41 && charCode <= 0x5a) ||
    (charCode >= 0x61 && charCode <= 0x7a)
  );
}

function isSpecial(charCode: number): boolean {
  return charCode === 0x2e || charCode === 0x2d || charCode === 0x24 || charCode === 0x5f;
}

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

//https://eu-west-1.console.aws.amazon.com/cloudwatch/home?region=eu-west-1#logsV2:logs-insights$3FqueryDetail$3D~
export function encodeUrl(obj: AwsUrl, region: string): string {
  return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logsV2:logs-insights$3FqueryDetail$3D~${encodeObject(
    obj
  )}`;
}

export function encodeObject(obj: any): string {
  if (Array.isArray(obj)) {
    return `(~${obj.map(v => encodeObject(v)).join('~')})`;
  }

  switch (typeof obj) {
    case 'string':
      return `'${encodeString(obj)}`;
    case 'object':
      return `(${Object.entries(obj)
        .map(([key, val]) => `${key}~${encodeObject(val)}`)
        .join('~')})`;
    case 'number':
    case 'boolean':
    default:
      return `${obj}`;
  }
}
