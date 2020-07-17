import React from 'react';
import { mount } from 'enzyme';
import { TextPanel } from './TextPanel';
import { dateMath, dateTime, LoadingState, FieldConfigSource } from '@grafana/data';
import { TextOptions } from './types';
import { updateConfig } from 'app/core/config';

describe('TextPanel', () => {
  describe('when html sanitization disabled', () => {
    it('should evaluate provided scripts', done => {
      jest.spyOn(window, 'alert').mockImplementation(() => {});

      updateConfig({
        disableSanitizeHtml: true,
      });

      expect(window.alert).not.toBeCalled();

      createTextPanel({
        series: [],
        timeRange: {
          from: dateMath.parse('now-6h') || dateTime(),
          to: dateMath.parse('now') || dateTime(),
          raw: { from: 'now-6h', to: 'now' },
        },
        state: LoadingState.Done,
      });

      expect(window.alert).toBeCalled();
    });
  });
});

const createTextPanel = (data: PanelData) => {
  const timeRange = {
    from: dateMath.parse('now-6h') || dateTime(),
    to: dateMath.parse('now') || dateTime(),
    raw: { from: 'now-6h', to: 'now' },
  };

  const options: TextOptions = {
    content: '<script>alert("evaluated!");</script>',
    mode: 'html',
  };

  const fieldConfig: FieldConfigSource = {
    defaults: {},
    overrides: [],
  };

  return mount<TextPanel>(
    <TextPanel
      id={1}
      data={data}
      timeRange={timeRange}
      timeZone={'utc'}
      options={options}
      fieldConfig={fieldConfig}
      onFieldConfigChange={() => {}}
      onOptionsChange={() => {}}
      onChangeTimeRange={() => {}}
      replaceVariables={s => s}
      renderCounter={0}
      width={532}
      transparent={false}
      height={250}
    />
  );
};
