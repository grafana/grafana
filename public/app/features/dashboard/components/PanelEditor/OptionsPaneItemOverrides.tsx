import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Tooltip, useStyles2 } from '@grafana/ui';

import { OptionPaneItemOverrideInfo } from './types';

export interface Props {
  overrides: OptionPaneItemOverrideInfo[];
}

export function OptionsPaneItemOverrides({ overrides }: Props) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {overrides.map((override, index) => (
        <Tooltip content={override.tooltip} key={index.toString()} placement="top">
          <div aria-label={override.description} className={styles[override.type]} />
        </Tooltip>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const common = {
    width: 8,
    height: 8,
    borderRadius: theme.shape.radius.circle,
    marginLeft: theme.spacing(1),
    top: '-1px',
  };

  return {
    wrapper: css({
      display: 'flex',
    }),
    rule: css({
      ...common,
      position: 'relative',
      backgroundColor: theme.colors.primary.main,
    }),
    data: css({
      ...common,
      position: 'relative',
      backgroundColor: theme.colors.warning.main,
    }),
  };
};
