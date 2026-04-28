import { css } from '@emotion/css';
import { useMemo, useState, useEffect } from 'react';

import { type StandardEditorProps, type SelectableValue, type GrafanaTheme2 } from '@grafana/data';
import { Alert, Select } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

import { GAZETTEER_OPTIONS, type Gazetteer, getGazetteer } from '../gazetteer/gazetteer';

const defaultPaths: Array<SelectableValue<string>> = Object.values(GAZETTEER_OPTIONS).map(
  ({ label, description, path }) => ({ label, description, value: path })
);

export interface GazetteerPathEditorConfigSettings {
  options?: Array<SelectableValue<string>>;
}

export const GazetteerPathEditor = ({
  value,
  onChange,
  context,
  item,
}: StandardEditorProps<string, GazetteerPathEditorConfigSettings>) => {
  const styles = useStyles2(getStyles);
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

const getStyles = (theme: GrafanaTheme2) => ({
  keys: css({
    marginTop: theme.spacing(0.5),
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',

    '> span': {
      marginLeft: theme.spacing(0.5),
    },
  }),
});
