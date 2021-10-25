import React, { FC, useMemo } from 'react';
import { StandardEditorProps, SelectableValue, GrafanaTheme2 } from '@grafana/data';
import { Alert, Select, stylesFactory, useTheme2 } from '@grafana/ui';
import { COUNTRIES_GAZETTEER_PATH, getGazetteer } from '../gazetteer/gazetteer';
import { css } from '@emotion/css';
import { useAsync } from 'react-use';

const paths: Array<SelectableValue<string>> = [
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

export const GazetteerPathEditor: FC<StandardEditorProps<string, any, any>> = ({ value, onChange, context }) => {
  const styles = getStyles(useTheme2());
  const gaz = useAsync(() => getGazetteer(value), [value]);

  const { current, options } = useMemo(() => {
    let options = [...paths];
    let current = options.find((f) => f.value === value);
    if (!current && value) {
      current = {
        label: value,
        value: value,
      };
      options.push(current);
    }
    return { options, current };
  }, [value]);

  return (
    <>
      <Select
        menuShouldPortal
        value={current}
        options={options}
        onChange={(v) => onChange(v.value)}
        allowCustomValue={true}
        formatCreateLabel={(txt) => `Load from URL: ${txt}`}
        isLoading={gaz.loading}
      />
      {gaz?.value && (
        <>
          {gaz?.value.error && <Alert title={gaz?.value.error} severity={'warning'} />}
          {gaz?.value.count && (
            <div className={styles.keys}>
              <b>({gaz?.value.count})</b>
              {gaz?.value.examples(10).map((k) => (
                <span key={k}>{k},</span>
              ))}
              {gaz?.value.count > 10 && ' ...'}
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
