import { css } from "@emotion/css";
import { VariableSizeList } from "react-window";
import tinycolor from "tinycolor2";

import { GrafanaTheme2 } from "@grafana/data";
import { useTranslate } from "@grafana/i18n";
import { IconButton, Input, useStyles2 } from "@grafana/ui";

import { useLogListContext } from "./LogListContext";
import { LogListModel } from "./processing";

interface Props {
  listRef: VariableSizeList | null;
  logs: LogListModel[];
  width: number;
}

export const LogListSearch = ({ listRef, logs, width }: Props) => {
  const { searchVisible, hideSearch } = useLogListContext();
  const styles = useStyles2(getStyles);
  const { t } = useTranslate();
  
  if (!searchVisible) {
    return null;
  }

  return (
    <div className={styles.container} style={{ width }}>
      <div style={{ width: Math.round(width / 2) }}>
        <Input autoFocus placeholder={t('logs.log-list-search.input-placeholder', 'Search in logs')} />
      </div>
      <IconButton onClick={hideSearch} name="times" aria-label={t('logs.log-list-search.close', 'Close search')} />
    </div>
  )
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    background: tinycolor(theme.colors.background.primary).setAlpha(0.8).toRgbString(),
    display: 'flex',
    gap: theme.spacing(1),
    padding: theme.spacing(0.5),
    position: 'absolute',
    top: theme.spacing(0.5),
    left: theme.spacing(1.25),
    zIndex: theme.zIndex.modal,
  }),
})

