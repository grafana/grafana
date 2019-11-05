import React from 'react';
import { FormField, FormLabel, Select } from '@grafana/ui';
import { DataSourceSettings } from '@grafana/data';
import { PromOptions } from '../types';

type Props = {
  value: DataSourceSettings<PromOptions>;
  onChange: (value: DataSourceSettings<PromOptions>) => void;
};

export const PromSettings = (props: Props) => {
  const { value, onChange } = props;

  const httpOptions = [{ value: 'GET', label: 'GET' }, { value: 'POST', label: 'POST' }];

  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              label="Scrape interval"
              labelWidth={13}
              value={value.jsonData.timeInterval}
              placeholder="15s"
              spellCheck={false}
              tooltip="Set this to your global scrape interval defined in your Prometheus config file. This will be used as a lower limit for the
        Prometheus step query parameter."
            />
          </div>
        </div>
        <div className="gf-form-inline">
          <div className="gf-form">
            <FormField
              label="Query timeout"
              labelWidth={13}
              value={value.jsonData.queryTimeout}
              spellCheck={false}
              placeholder="60s"
              tooltip="Set the Prometheus query timeout."
            />
          </div>
        </div>
        <div className="gf-form">
          <FormLabel
            width={13}
            tooltip="Specify the HTTP Method to query Prometheus. (POST is only available in Prometheus >= v2.1.0)"
          >
            HTTP Method
          </FormLabel>
          <Select
            options={httpOptions}
            value={httpOptions.find(o => o.value === value.jsonData.httpMethod)}
            width={7}
          />
        </div>
      </div>
    </>
  );
};
