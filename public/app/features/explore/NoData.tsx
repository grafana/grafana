import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, PanelContainer } from '@grafana/ui';

export const NoData = () => {
  const css = useStyles2(getStyles);
  return (
    <>
      <PanelContainer data-testid="explore-no-data" className={css.wrapper}>
        <span className={css.message}>{'No data'}</span>
      </PanelContainer>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    label: 'no-data-card',
    padding: theme.spacing(3),
    background: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  }),
  message: css({
    fontSize: theme.typography.h2.fontSize,
    padding: theme.spacing(4),
    color: theme.colors.text.disabled,
  }),
});
