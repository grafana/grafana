import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2, DataLinkButton } from '@grafana/ui';

import { type SpanLinkModel } from '../../types/links';

interface Props {
  spanLinkModel: SpanLinkModel;
}

export const LogsLinkButton = ({ spanLinkModel }: Props) => {
  const styles = useStyles2(getStyles);
  const { linkModel, icon, className } = spanLinkModel;
  return (
    <span className={styles}>
      <DataLinkButton link={linkModel} buttonProps={{ icon, className }}></DataLinkButton>
    </span>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return css({
    [theme.breakpoints.down('sm')]: {
      span: { display: 'none' },
    },
  });
}
