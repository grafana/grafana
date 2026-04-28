import { css } from '@emotion/css';

import { type StandardEditorProps, type GrafanaTheme2, type UnitFieldConfigSettings } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, UnitPicker } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';

type Props = StandardEditorProps<string, UnitFieldConfigSettings>;

export function UnitValueEditor({ value, onChange, item, id }: Props) {
  const styles = useStyles2(getStyles);

  if (item?.settings?.isClearable && value != null) {
    return (
      <div className={styles.wrapper}>
        <span className={styles.first}>
          <UnitPicker value={value} onChange={onChange} id={id} />
        </span>
        <IconButton
          name="times"
          onClick={() => onChange(undefined)}
          tooltip={t('options-ui.units.clear-tooltip', 'Clear unit selection')}
        />
      </div>
    );
  }
  return <UnitPicker value={value} onChange={onChange} id={id} />;
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
