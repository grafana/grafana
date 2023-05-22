import { css } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';

import { GrafanaTheme2, PanelPluginMeta, SelectableValue } from '@grafana/data';
import { Icon, Button, MultiSelect, useStyles2 } from '@grafana/ui';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';

export interface Props {
  onChange: (plugins: PanelPluginMeta[]) => void;
  maxMenuHeight?: number;
}

export const PanelTypeFilter = ({ onChange: propsOnChange, maxMenuHeight }: Props): JSX.Element => {
  const plugins = useMemo<PanelPluginMeta[]>(() => getAllPanelPluginMeta(), []);
  const options = useMemo(
    () =>
      plugins
        .map((p) => ({ label: p.name, imgUrl: p.info.logos.small, value: p }))
        .sort((a, b) => a.label?.localeCompare(b.label)),
    [plugins]
  );
  const [value, setValue] = useState<Array<SelectableValue<PanelPluginMeta>>>([]);
  const onChange = useCallback(
    (plugins: Array<SelectableValue<PanelPluginMeta>>) => {
      const changedPlugins = plugins.filter((p) => p.value).map((p) => p.value!);
      propsOnChange(changedPlugins);
      setValue(plugins);
    },
    [propsOnChange]
  );
  const styles = useStyles2(getStyles);

  const selectOptions = {
    defaultOptions: true,
    getOptionLabel: (i: SelectableValue<PanelPluginMeta>) => i.label,
    getOptionValue: (i: SelectableValue<PanelPluginMeta>) => i.value,
    noOptionsMessage: 'No Panel types found',
    placeholder: 'Filter by type',
    maxMenuHeight,
    options,
    value,
    onChange,
  };

  return (
    <div className={styles.container}>
      {value.length > 0 && (
        <Button
          size="xs"
          icon="trash-alt"
          fill="text"
          className={styles.clear}
          onClick={() => onChange([])}
          aria-label="Clear types"
        >
          Clear types
        </Button>
      )}
      <MultiSelect<PanelPluginMeta> {...selectOptions} prefix={<Icon name="filter" />} aria-label="Panel Type filter" />
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css`
      label: container;
      position: relative;
      min-width: 180px;
      flex-grow: 1;
    `,
    clear: css`
      label: clear;
      font-size: ${theme.spacing(1.5)};
      position: absolute;
      top: -${theme.spacing(4.5)};
      right: 0;
    `,
  };
}
