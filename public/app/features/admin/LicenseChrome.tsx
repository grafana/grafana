import React from 'react';
import { stylesFactory, ThemeContext } from '@grafana/ui';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

const title = { fontWeight: 600, fontSize: '26px', lineHeight: '123%' };

const contentContainerStyle = stylesFactory((theme: GrafanaTheme) => {
  const background = theme.isDark ? '#202226' : '#FFFFFF';

  return css`
    display: grid;
    grid-template-columns: 100%;
    column-gap: 20px;
    row-gap: 40px;
    padding: 34px 20px 0 77px;
    background-color: ${background};
    @media (min-width: 1050px) {
      grid-template-columns: 50% 50%;
    }
  `;
});

const headerStyle = stylesFactory((theme: GrafanaTheme) => {
  const backgroundUrl = theme.isDark
    ? '/public/img/licensing/header_dark.svg'
    : '/public/img/licensing/header_light.svg';

  return css`
    height: 137px;
    padding: 40px 0 0 79px;
    position: relative;
    background: url('${backgroundUrl}') right;
  `;
});

interface Props {
  header: string;
  subheader?: React.ReactNode;
}

export const LicenseChrome: React.FC<Props> = ({ header, subheader, children }) => {
  const theme = React.useContext(ThemeContext);

  return (
    <>
      <div className={headerStyle(theme)}>
        <h2 style={title}>{header}</h2>
        {subheader && subheader}

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
            className="logo-icon"
            src="/public/img/grafana_icon.svg"
            alt="Grafana"
            width="80px"
            style={{ position: 'absolute', left: '24px', top: '10px' }}
          />
          <img
            className="logo-icon"
            src="/public/img/grafana_enterprise_typelogo.svg"
            alt="Grafana Enterprise"
            width="70px"
            style={{ position: 'absolute', left: '29px', top: '90px' }}
          />
        </Circle>
      </div>

      <div className={contentContainerStyle(theme)}>{children}</div>
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
        borderRadius: '50%',
        ...style,
      }}
    >
      {children && <>{children}</>}
    </div>
  );
};

export const Orbit: React.FC<CircleProps> = ({ size, style, children }) => {
  const theme = React.useContext(ThemeContext);
  const borderColor = theme.isDark ? '#343B40' : '#E9EDF2';

  style['border'] = '2px solid ' + borderColor;
  style['position'] = 'absolute';
  return (
    <Circle size={size} style={style}>
      {children}
    </Circle>
  );
};
