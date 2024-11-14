import { initTemplateSrv } from 'test/helpers/initTemplateSrv';

import { DataContextScopedVar, FieldType, toDataFrame } from '@grafana/data';
import { TemplateSrv } from '@grafana/runtime';

describe('dataMacros', () => {
  let _templateSrv: TemplateSrv;

  beforeEach(() => {
    _templateSrv = initTemplateSrv('hello', []);
  });

  const data = toDataFrame({
    name: 'frameName',
    refId: 'refIdA',
    fields: [
      {
        name: 'CoolNumber',
        type: FieldType.number,
        values: [5, 10],
        labels: { cluster: 'US', region: 'west=1' },
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
        data: [data],
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
        data: [data],
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
        data: [data],
        frame: data,
        field: data.fields[0],
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(_templateSrv.replace('${__value.raw}', scopedVars)).toBe('${__value.raw}');
  });

  it('Should interpolate __data.* correctly', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
        rowIndex: 1,
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(_templateSrv.replace('${__data.fields[1]}', scopedVars)).toBe('10000');
    expect(_templateSrv.replace('${__data.fields[0]}', scopedVars)).toBe('10%');
    expect(_templateSrv.replace('${__data.fields[0].text}', scopedVars)).toBe('10');
    expect(_templateSrv.replace('${__data.fields["CoolNumber"].text}', scopedVars)).toBe('10');
    expect(_templateSrv.replace('${__data.name}', scopedVars)).toBe('frameName');
    expect(_templateSrv.replace('${__data.refId}', scopedVars)).toBe('refIdA');
    expect(_templateSrv.replace('${__data.fields[0]:percentencode}', scopedVars)).toBe('10%25');
  });

  it('${__data.*} should return match when the rowIndex is missing dataContext is not there', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(_templateSrv.replace('${__data.name}', scopedVars)).toBe('${__data.name}');
  });

  it('Should interpolate ${__series} to frame display name', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
        frameIndex: 0,
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(_templateSrv.replace('${__series.name}', scopedVars)).toBe('frameName');
  });

  it('Should interpolate ${__field.*} correctly', () => {
    const dataContext: DataContextScopedVar = {
      value: {
        data: [data],
        frame: data,
        field: data.fields[0],
        frameIndex: 0,
      },
    };

    const scopedVars = { __dataContext: dataContext };

    expect(_templateSrv.replace('${__field.name}', scopedVars)).toBe('CoolNumber');
    expect(_templateSrv.replace('${__field.labels.cluster}', scopedVars)).toBe('US');
    expect(_templateSrv.replace('${__field.labels.region:percentencode}', scopedVars)).toBe('west%3D1');
  });
});
