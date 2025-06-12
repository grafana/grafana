import { css } from '@emotion/css';
import { useCallback, useMemo, useState } from 'react';

import { GrafanaTheme2, PanelPluginMeta, SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Icon, Button, MultiSelect, useStyles2 } from '@grafana/ui';
import { getAllPanelPluginMeta } from 'app/features/panel/state/util';

export interface Props {
  onChange: (plugins: PanelPluginMeta[]) => void;
  maxMenuHeight?: number;
}

export const PanelTypeFilter = ({ onChange: propsOnChange, maxMenuHeight }: Props): JSX.Element => {
  const plugins = useMemo<PanelPluginMeta[]>(getAllPanelPluginMeta, []);
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
    noOptionsMessage: t('panel-type-filter.select-no-options', 'No panel types found'),
    placeholder: t('panel-type-filter.select-placeholder', 'Filter by type'),
    maxMenuHeight,
    options,
    value,
    onChange,
  };

  return (
    <div className={styles.container}>
      {value.length > 0 && (
        <Button size="xs" icon="trash-alt" fill="text" className={styles.clear} onClick={() => onChange([])}>
          <Trans i18nKey="panel-type-filter.clear-button">Clear types</Trans>
        </Button>
      )}
      <MultiSelect<PanelPluginMeta>
        {...selectOptions}
        prefix={<Icon name="filter" />}
        aria-label={t('panel-type-filter.select-aria-label', 'Panel type filter')}
      />
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    container: css({
      label: 'container',
      position: 'relative',
      minWidth: '180px',
      flexGrow: 1,
    }),
    clear: css({
      label: 'clear',
      fontSize: theme.spacing(1.5),
      position: 'absolute',
      top: theme.spacing(-4.5),
      right: 0,
    }),
  };
}
