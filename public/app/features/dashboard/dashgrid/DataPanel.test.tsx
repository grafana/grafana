// Library
import React from 'react';
import { Subject } from 'rxjs';

import { mount } from 'enzyme';

import { DataPanel, getProcessedSeriesData } from './DataPanel';
import { SeriesData } from '@grafana/ui';

describe('DataPanel', () => {
  let dataPanel: DataPanel;

  beforeEach(() => {
    // mount lets us call setState()
    const wrapper = mount(
      <DataPanel
        queries={[]}
        panelId={1}
        widthPixels={100}
        refreshCounter={1}
        datasource={'xxx'}
        onError={(message, error) => {}}
        children={r => {
          return <div>hello</div>;
        }}
      />
    );
    dataPanel = wrapper.instance() as DataPanel;
  });

  it('starts with unloaded state', () => {
    expect(dataPanel.state.isFirstLoad).toBe(true);
  });

  it('converts timeseries to table skipping nulls', () => {
    const input1 = {
      target: 'Field Name',
      datapoints: [[100, 1], [200, 2]],
    };
    const input2 = {
      // without target
      target: '',
      datapoints: [[100, 1], [200, 2]],
    };
    const data = getProcessedSeriesData([null, input1, input2, null, null]);
    expect(data.length).toBe(2);
    expect(data[0].fields[0].name).toBe(input1.target);
    expect(data[0].rows).toBe(input1.datapoints);

    // Default name
    expect(data[1].fields[0].name).toEqual('Value');

    // Every colun should have a name and a type
    for (const table of data) {
      for (const column of table.fields) {
        expect(column.name).toBeDefined();
        expect(column.type).toBeDefined();
      }
    }
  });

  it('supports null values from query OK', () => {
    expect(getProcessedSeriesData([null, null, null, null])).toEqual([]);
    expect(getProcessedSeriesData(undefined)).toEqual([]);
    expect(getProcessedSeriesData((null as unknown) as any[])).toEqual([]);
    expect(getProcessedSeriesData([])).toEqual([]);
  });

  it('Registers a StreamObserver from the response', () => {
    expect(dataPanel.streams.size).toBe(0);

    const subject = new Subject<SeriesData>();
    const series = dataPanel.processResponseData({
      data: [
        {
          refId: 'A',
          fields: [],
          rows: [],
          stream: subject,
        },
      ],
    });
    dataPanel.setState({ data: series });

    expect(series.length).toBe(1);
    expect(dataPanel.streams.size).toBe(1);
    expect(subject.observers.length).toBe(1);

    // Post an update and make sure it got into the response
    const update = {
      refId: 'A',
      fields: [{ name: 'a' }],
      rows: [[1]],
    };
    subject.next(update);
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        expect(dataPanel.state.data[0]).toEqual(update);

        // Now process something without that stream
        dataPanel.processResponseData({
          data: [
            {
              refId: 'A',
              fields: [],
              rows: [],
            },
          ],
        });
        expect(dataPanel.streams.size).toBe(0);
        expect(subject.observers.length).toBe(0);
        resolve(); // done;
      }, 250); // there is a 100ms throttle on next!
    });
  });
});
