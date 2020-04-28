import React from 'react';
import { stylesFactory, useTheme } from '@grafana/ui';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

const title = { fontWeight: 500, fontSize: '26px', lineHeight: '123%' };

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const backgroundUrl = theme.isDark ? 'public/img/licensing/header_dark.svg' : 'public/img/licensing/header_light.svg';
  const footerBg = theme.isDark ? theme.palette.dark9 : theme.palette.gray6;

  return {
    container: css`
      padding: 36px 79px;
      background: ${theme.colors.panelBg};
    `,
    footer: css`
      text-align: center;
      padding: 16px;
      background: ${footerBg};
    `,
    header: css`
      height: 137px;
      padding: 40px 0 0 79px;
      position: relative;
      background: url('${backgroundUrl}') right;
  `,
  };
});

interface Props {
  header: string;
  subheader?: string;
  editionNotice?: string;
}

export const LicenseChrome: React.FC<Props> = ({ header, editionNotice, subheader, children }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <>
      <div className={styles.header}>
        <h2 style={title}>{header}</h2>
        {subheader && <h3>{subheader}</h3>}

        <Circle
          size="128px"
          style={{
            boxShadow: '0px 0px 24px rgba(24, 58, 110, 0.45)',
            background: '#0A1C36',
            position: 'absolute',
            top: '19px',
            left: '71%',
          }}
        >
          <img
            src="public/img/grafana_icon.svg"
            alt="Grafana"
            width="80px"
            style={{ position: 'absolute', left: '23px', top: '20px' }}
          />
        </Circle>
      </div>

      <div className={styles.container}>{children}</div>

      {editionNotice && <div className={styles.footer}>{editionNotice}</div>}
    </>
  );
};

interface CircleProps {
  size: string;
  style?: React.CSSProperties;
}

export const Circle: React.FC<CircleProps> = ({ size, style, children }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'absolute',
        bottom: 0,
        right: 0,
        borderRadius: '50%',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
