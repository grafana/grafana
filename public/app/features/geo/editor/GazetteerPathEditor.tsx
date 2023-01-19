import { css } from '@emotion/css';
import React, { useMemo, useState, useEffect } from 'react';

import { StandardEditorProps, SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { Alert, Select, stylesFactory, useTheme2 } from '@grafana/ui';

import { COUNTRIES_GAZETTEER_PATH, Gazetteer, getGazetteer } from '../gazetteer/gazetteer';

const defaultPaths: Array<SelectableValue<string>> = [
  {
    label: 'Countries',
    description: 'Lookup countries by name, two letter code, or three letter code',
    value: COUNTRIES_GAZETTEER_PATH,
  },
  {
    label: 'USA States',
    description: 'Lookup states by name or 2 ',
    value: 'public/gazetteer/usa-states.json',
  },
  {
    label: 'Airports',
    description: 'Lookup airports by id or code',
    value: 'public/gazetteer/airports.geojson',
  },
];

export interface GazetteerPathEditorConfigSettings {
  options?: Array<SelectableValue<string>>;
}

export const GazetteerPathEditor = ({
  value,
  onChange,
  context,
  item,
}: StandardEditorProps<string, GazetteerPathEditorConfigSettings>) => {
  const styles = getStyles(useTheme2());
  const [gaz, setGaz] = useState<Gazetteer>();
  const settings = item.settings;

  useEffect(() => {
    async function fetchData() {
      const p = await getGazetteer(value);
      setGaz(p);
    }
    fetchData();
  }, [value, setGaz]);

  const { current, options } = useMemo(() => {
    let options = settings?.options ? [...settings.options] : [...defaultPaths];
    let current = options?.find((f) => f.value === gaz?.path);
    if (!current && gaz) {
      current = {
        label: gaz.path,
        value: gaz.path,
      };
      options.push(current);
    }
    return { options, current };
  }, [gaz, settings?.options]);

  return (
    <>
      <Select
        value={current}
        options={options}
        onChange={(v) => onChange(v.value)}
        allowCustomValue={true}
        formatCreateLabel={(txt) => `Load from URL: ${txt}`}
      />
      {gaz && (
        <>
          {gaz.error && <Alert title={gaz.error} severity={'warning'} />}
          {gaz.count && (
            <div className={styles.keys}>
              <b>({gaz.count})</b>
              {gaz.examples(10).map((k) => (
                <span key={k}>{k},</span>
              ))}
              {gaz.count > 10 && ' ...'}
            </div>
          )}
        </>
      )}
    </>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    keys: css`
      margin-top: 4px;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;

      > span {
        margin-left: 4px;
      }
    `,
  };
});
