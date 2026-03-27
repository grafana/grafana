import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import alertDef from 'app/features/alerting/state/alertDef';

interface Props {
  alertState: string | undefined;
}

export const AnnotationAlertState = ({ alertState }: Props) => {
  const styles = useStyles2(getStyles);
  if (!alertState) {
    return null;
  }

  const stateModel = alertDef.getStateDisplayModel(alertState);
  return (
    <div className={styles.alertState}>
      <i className={stateModel.stateClass}>{stateModel.text}</i>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  alertState: css({
    paddingRight: theme.spacing(1),
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
