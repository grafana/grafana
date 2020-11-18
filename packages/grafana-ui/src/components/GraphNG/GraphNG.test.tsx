import React from 'react';
import { GraphNG } from './GraphNG';
import { render } from '@testing-library/react';
import { ArrayVector, dateTime, FieldConfig, FieldType, MutableDataFrame } from '@grafana/data';
import { GraphCustomFieldConfig } from '..';

const mockData = () => {
  const data = new MutableDataFrame();

  data.addField({
    type: FieldType.time,
    name: 'Time',
    values: new ArrayVector([1602630000000, 1602633600000, 1602637200000]),
    config: {},
  });

  data.addField({
    type: FieldType.number,
    name: 'Value',
    values: new ArrayVector([10, 20, 5]),
    config: {
      custom: {
        line: { show: true },
      },
    } as FieldConfig<GraphCustomFieldConfig>,
  });

  const timeRange = {
    from: dateTime(1602673200000),
    to: dateTime(1602680400000),
    raw: { from: '1602673200000', to: '1602680400000' },
  };
  return { data, timeRange };
};

// const defaultLegendOptions: LegendOptions = {
//   displayMode: LegendDisplayMode.List,
//   placement: 'bottom',
// };

describe('GraphNG', () => {
  // describe('data update', () => {
  //   it('does not re-initialise uPlot when there are no field config changes', () => {
  //     const { data, timeRange } = mockData();
  //     const onDataUpdateSpy = jest.fn();
  //     const onPlotInitSpy = jest.fn();
  //
  //     const { rerender } = render(
  //       <GraphNG
  //         data={[data]}
  //         timeRange={timeRange}
  //         timeZone={'browser'}
  //         width={100}
  //         height={100}
  //         onDataUpdate={onDataUpdateSpy}
  //         onPlotInit={onPlotInitSpy}
  //         legend={defaultLegendOptions}
  //       />
  //     );
  //
  //     data.fields[1].values.set(0, 1);
  //
  //     rerender(
  //       <GraphNG
  //         data={[data]}
  //         timeRange={timeRange}
  //         timeZone={'browser'}
  //         width={100}
  //         height={100}
  //         onDataUpdate={onDataUpdateSpy}
  //         onPlotInit={onPlotInitSpy}
  //         legend={defaultLegendOptions}
  //       />
  //     );
  //
  //     expect(onPlotInitSpy).toBeCalledTimes(1);
  //     expect(onDataUpdateSpy).toHaveBeenLastCalledWith([
  //       [1602630000, 1602633600, 1602637200],
  //       [1, 20, 5],
  //     ]);
  //   });
  // });

  describe('config update', () => {
    it('should skip plot intialization for width and height equal 0', () => {
      const { data, timeRange } = mockData();
      const onPlotInitSpy = jest.fn();

      render(
        <GraphNG
          data={[data]}
          timeRange={timeRange}
          timeZone={'browser'}
          width={0}
          height={0}
          onPlotInit={onPlotInitSpy}
        />
      );

      expect(onPlotInitSpy).not.toBeCalled();
    });

    // it('reinitializes plot when number of series change', () => {
    //   const { data, timeRange } = mockData();
    //   const onPlotInitSpy = jest.fn();
    //
    //   const { rerender } = render(
    //     <GraphNG
    //       data={[data]}
    //       timeRange={timeRange}
    //       timeZone={'browser'}
    //       width={100}
    //       height={100}
    //       onPlotInit={onPlotInitSpy}
    //     />
    //   );
    //
    //   data.addField({
    //     name: 'Value1',
    //     type: FieldType.number,
    //     values: new ArrayVector([1, 2, 3]),
    //     config: {
    //       custom: {
    //         line: { show: true },
    //       },
    //     } as FieldConfig<GraphCustomFieldConfig>,
    //   });
    //
    //   rerender(
    //     <GraphNG
    //       data={[data]}
    //       timeRange={timeRange}
    //       timeZone={'browser'}
    //       width={100}
    //       height={100}
    //       onPlotInit={onPlotInitSpy}
    //     />
    //   );
    //
    //   expect(onPlotInitSpy).toBeCalledTimes(2);
    // });
    //
    // it('reinitializes plot when series field config changes', () => {
    //   const { data, timeRange } = mockData();
    //   const onPlotInitSpy = jest.fn();
    //
    //   const { rerender } = render(
    //     <GraphNG
    //       data={[data]}
    //       timeRange={timeRange}
    //       timeZone={'browser'}
    //       width={100}
    //       height={100}
    //       onPlotInit={onPlotInitSpy}
    //     />
    //   );
    //   expect(onPlotInitSpy).toBeCalledTimes(1);
    //
    //   data.fields[1].config.custom.line.width = 5;
    //
    //   rerender(
    //     <GraphNG
    //       data={[data]}
    //       timeRange={timeRange}
    //       timeZone={'browser'}
    //       width={100}
    //       height={100}
    //       onPlotInit={onPlotInitSpy}
    //     />
    //   );
    //
    //   expect(onPlotInitSpy).toBeCalledTimes(2);
    // });
  });
});
