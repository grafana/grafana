jest.mock('ol-mapbox-style', () => ({}));
jest.mock('geotiff', () => ({}));

import BaseLayer from 'ol/layer/Base';

import {
  DataFrame,
  DataQueryRequest,
  FieldType,
  LoadingState,
  MapLayerHandler,
  MapLayerOptions,
  PanelData,
  TimeRange,
} from '@grafana/data';

import { applyLayerFilter } from './layers';

describe('applyLayerFilter', () => {
  const createDataFrame = (refId: string): DataFrame => ({
    refId,
    fields: [{ name: 'value', type: FieldType.number, values: [1, 2, 3], config: {} }],
    length: 3,
  });

  it('should apply filter when query exists and is visible', () => {
    const update = jest.fn();
    const handler: MapLayerHandler = {
      init: () => ({}) as BaseLayer,
      update,
    };
    const options: MapLayerOptions = {
      name: 'Test',
      type: 'markers',
      filterData: { id: 'byRefId', options: 'A' },
    };
    const panelData: PanelData = {
      series: [createDataFrame('A'), createDataFrame('B')],
      state: LoadingState.Done,
      timeRange: {} as TimeRange,
      request: { targets: [{ refId: 'A' }, { refId: 'B' }] } as DataQueryRequest,
    };

    applyLayerFilter(handler, options, panelData);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        series: [createDataFrame('A')],
      })
    );
  });

  it('should return empty series when query exists but is hidden', () => {
    const update = jest.fn();
    const handler: MapLayerHandler = {
      init: () => ({}) as BaseLayer,
      update,
    };
    const options: MapLayerOptions = {
      name: 'Test',
      type: 'markers',
      filterData: { id: 'byRefId', options: 'A' },
    };
    const panelData: PanelData = {
      series: [createDataFrame('B')],
      state: LoadingState.Done,
      timeRange: {} as TimeRange,
      request: { targets: [{ refId: 'A', hide: true }, { refId: 'B' }] } as DataQueryRequest,
    };

    applyLayerFilter(handler, options, panelData);

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        series: [],
      })
    );
  });

  it('should not apply filter when query does not exist', () => {
    const update = jest.fn();
    const handler: MapLayerHandler = {
      init: () => ({}) as BaseLayer,
      update,
    };
    const options: MapLayerOptions = {
      name: 'Test',
      type: 'markers',
      filterData: { id: 'byRefId', options: 'C' },
    };
    const panelData: PanelData = {
      series: [createDataFrame('A'), createDataFrame('B')],
      state: LoadingState.Done,
      timeRange: {} as TimeRange,
      request: { targets: [{ refId: 'A' }, { refId: 'B' }] } as DataQueryRequest,
    };

    applyLayerFilter(handler, options, panelData);

    expect(update).toHaveBeenCalledWith(panelData);
  });

  it('should pass through all data when no filter is configured', () => {
    const update = jest.fn();
    const handler: MapLayerHandler = {
      init: () => ({}) as BaseLayer,
      update,
    };
    const options: MapLayerOptions = {
      name: 'Test',
      type: 'markers',
    };
    const panelData: PanelData = {
      series: [createDataFrame('A'), createDataFrame('B')],
      state: LoadingState.Done,
      timeRange: {} as TimeRange,
    };

    applyLayerFilter(handler, options, panelData);

    expect(update).toHaveBeenCalledWith(panelData);
  });
});
