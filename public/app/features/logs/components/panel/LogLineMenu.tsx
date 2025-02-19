import { IconButton } from "@grafana/ui";

import { LogLineStyles } from "./LogLine";
import { LogListModel } from "./processing"

interface Props {
  log: LogListModel;
  styles: LogLineStyles;
}

export const LogLineMenu = ({ styles }: Props) => {
  return (
    <IconButton className={styles.menuIcon} name="ellipsis-v" aria-label="Log menu" />
  )
}
