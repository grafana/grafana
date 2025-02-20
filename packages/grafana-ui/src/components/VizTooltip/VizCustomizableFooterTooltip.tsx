import { css } from '@emotion/css';

import { Field, GrafanaTheme2, LinkModel } from '@grafana/data';

import { DataLinkButton, Stack } from '..';
import { useStyles2 } from '../../themes';

interface Props {
  dataLinks: Array<LinkModel<Field>>;
}

export const VizCustomizableFooterTooltip = ({ dataLinks }: Props) => {
  const isSingleLink = dataLinks.length === 1;
  const styles = useStyles2((theme) => getStyles(theme, isSingleLink));

  if (!dataLinks.length) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      <Stack direction="column" justifyContent="flex-start" gap={0.5}>
        {dataLinks.map((link, i) => (
          <DataLinkButton
            key={i}
            link={link}
            buttonProps={{
              className: styles.dataLinkButton,
              fill: 'text',
              size: 'md',
              icon: isSingleLink ? 'fire' : 'link',
            }}
          />
        ))}
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, isSingleLink: boolean) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.medium}`,
  }),
  dataLinkButton: css({
    fontSize: '16px',
    fontWeight: 400,
    cursor: 'pointer',
    backgroundColor: isSingleLink ? 'rgba(61, 113, 217, 1)' : 'inherit',
    color: isSingleLink ? 'white' : 'link',
    '&:hover': {
      textDecoration: isSingleLink ? 'none' : 'underline',
      backgroundColor: isSingleLink ? 'rgba(61, 113, 217, 0.85)' : 'none',
    },
  }),
});
