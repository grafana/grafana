/*
 * This is a dummy plugin to test the frontend sandbox
 * It is not meant to be used in any other way
 * This file doesn't require any compilation
 */
define(['react', '@grafana/data'], function (React, grafanaData) {
  const { DataSourcePlugin, DataSourceApi, MutableDataFrame, FieldType } = grafanaData;
  const { useState } = React;

  const QueryEditor = (props) => {
    const [value, setValue] = useState('');

    const handleChange = (event) => {
      setValue(event.target.value);
      props.onChange({
        ...props.query,
        testValue: event.target.value,
      });
      props.onRunQuery();
    };

    return React.createElement(
      'div',
      null,
      React.createElement('label', { htmlFor: 'inputField' }, 'Dummy input field'),
      React.createElement('input', {
        type: 'text',
        id: 'inputField',
        'data-testid': 'sandbox-query-editor-query-input',
        value: value,
        onChange: handleChange,
      })
    );
  };

  const ConfigEditor = (props) => {
    const { onOptionsChange, options } = props;
    const value = options.jsonData.input || '';

    const handleChange = (event) => {
      onOptionsChange({
        ...options,
        jsonData: {
          input: event.target.value,
        },
      });
    };

    return React.createElement(
      'div',
      null,
      React.createElement('label', { htmlFor: 'inputField' }, 'Test Config field'),
      React.createElement('input', {
        type: 'text',
        id: 'inputField',
        'data-testid': 'sandbox-config-editor-query-input',
        value: value,
        onChange: handleChange,
      })
    );
  };

  class BasicDataSource extends DataSourceApi {
    constructor(instanceSettings) {
      super(instanceSettings);
    }

    // this is a test query it'll generate a logarithmic series starting now-1h
    async query(options) {
      const promises = options.targets.map(async (target) => {
        const query = target;

        const timestamps = [];
        const values = [];

        const endTime = Date.now();
        const startTime = endTime - 3600000; // 1 hour in milliseconds

        // Define the logarithmic base and increment factor
        const base = 2;
        const increment = 0.1;

        // Generate the data points
        for (let i = 0; i < 50; i++) {
          // Calculate the timestamp
          const timestamp = startTime + ((endTime - startTime) / 50) * i;
          timestamps.push(timestamp);

          // Calculate the value using logarithmic increase
          const value = Math.pow(base, increment * i);
          values.push(value);
        }

        return new MutableDataFrame({
          refId: query.refId,
          fields: [
            { name: 'Time', type: FieldType.time, values: timestamps },
            { name: 'Value', type: FieldType.number, values: values },
          ],
        });
      });
      return Promise.all(promises).then((data) => ({ data }));
    }
    async testDatasource() {
      return {
        status: 'success',
        message: 'Sandbox Success',
      };
    }
  }

  const plugin = new DataSourcePlugin(BasicDataSource).setConfigEditor(ConfigEditor).setQueryEditor(QueryEditor);

  return { plugin };
});
