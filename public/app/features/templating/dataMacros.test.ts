import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import { DataContextScopedVar, FieldType, toDataFrame } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

describe('templateSrv', () => {
  let _templateSrv: TemplateSrv;

  beforeEach(() => {
    _templateSrv = initTemplateSrv('hello', []);
  });

  const data = toDataFrame({
    name: 'A',
    fields: [
      {
        name: 'number',
        type: FieldType.number,
        values: [5, 10],
        display: (value: number) => {
          return { text: value.toString(), numeric: value, suffix: '%' };
        },
      },
      {
        name: 'time',
        type: FieldType.time,
        values: [5000, 10000],
      },
    ],
  });

  it('Should interpolate __value.* expressions with dataContext in scopedVars', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        frame: data,
        field: data.fields[0],
        rowIndex: 1,
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(_templateSrv.replace('${__value.raw}', scopedVars)).toBe('10');
    expect(_templateSrv.replace('${__value.numeric}', scopedVars)).toBe('10');
    expect(_templateSrv.replace('${__value}', scopedVars)).toBe('10%');
    expect(_templateSrv.replace('${__value.text}', scopedVars)).toBe('10');
    expect(_templateSrv.replace('${__value.time}', scopedVars)).toBe('10000');
    // can apply format as well
    expect(_templateSrv.replace('${__value:percentencode}', scopedVars)).toBe('10%25');
  });

  it('Should interpolate __value.* with calculatedValue', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        frame: data,
        field: data.fields[0],
        calculatedValue: {
          text: '15',
          numeric: 15,
          suffix: '%',
        },
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(_templateSrv.replace('${__value.raw}', scopedVars)).toBe('15');
    expect(_templateSrv.replace('${__value.numeric}', scopedVars)).toBe('15');
    expect(_templateSrv.replace('${__value}', scopedVars)).toBe('15%');
    expect(_templateSrv.replace('${__value.text}', scopedVars)).toBe('15%');
    expect(_templateSrv.replace('${__value.time}', scopedVars)).toBe('');
  });

  it('Should return match when ${__value.*} is used and no dataContext or rowIndex is found', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        frame: data,
        field: data.fields[0],
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(_templateSrv.replace('${__value.raw}', scopedVars)).toBe('${__value.raw}');
  });
});
