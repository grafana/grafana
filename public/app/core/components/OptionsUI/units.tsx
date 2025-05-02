import { css } from '@emotion/css';

import { StandardEditorProps, GrafanaTheme2, UnitFieldConfigSettings } from '@grafana/data';
import { IconButton, UnitPicker, useStyles2 } from '@grafana/ui';

import { t } from '../../internationalization';

type Props = StandardEditorProps<string, UnitFieldConfigSettings>;

export function UnitValueEditor({ value, onChange, item }: Props) {
  const styles = useStyles2(getStyles);
  if (item?.settings?.isClearable && value != null) {
    return (
      <div className={styles.wrapper}>
        <span className={styles.first}>
          <UnitPicker value={value} onChange={onChange} />
        </span>
        <IconButton
          name="times"
          onClick={() => onChange(undefined)}
          tooltip={t('options-ui.units.clear-tooltip', 'Clear unit selection')}
        />
      </div>
    );
  }
  return <UnitPicker value={value} onChange={onChange} />;
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    width: '100%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
  }),
  first: css({
    marginRight: theme.spacing(1),
    flexGrow: 2,
  }),
});
