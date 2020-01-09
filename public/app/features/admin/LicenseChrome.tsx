import React from 'react';
import { ThemeContext } from '@grafana/ui';
import { css } from 'emotion';

const title = { fontWeight: 600, fontSize: '26px', lineHeight: '123%' };

export function LicenseChrome({
  header,
  subheader,
  children,
}: {
  header: string;
  subheader?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const theme = React.useContext(ThemeContext);
  const backgroundDark = '#202226';
  const backgroundLight = '#FFFFFF';

  return (
    <React.Fragment>
      <div
        style={{
          height: '137px',
          backgroundColor: 'rgba(26, 86, 179, 0.2)',
          padding: '40px 0 0 79px',
          position: 'relative',
          background: theme.isDark
            ? "url('/public/img/licensing/header_dark.svg')"
            : "url('/public/img/licensing/header_light.svg')",
          backgroundPosition: 'right',
        }}
      >
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

      <div
        className={css`
          display: grid;
          grid-template-columns: 100%;
          column-gap: 20px;
          row-gap: 40px;
          padding: 34px 20px 0 77px;
          background-color: ${theme.isDark ? backgroundDark : backgroundLight};
          @media (min-width: 1050px) {
            grid-template-columns: 50% 50%;
          }
        `}
      >
        {children}
      </div>
    </React.Fragment>
  );
}

export class Circle extends React.PureComponent<any, any> {
  props: {
    size: string;
    style?: any;
    children?: React.ReactNode;
  };

  render() {
    const { size, style, children } = this.props;

    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          ...style,
        }}
      >
        {children && <React.Fragment>{children}</React.Fragment>}
      </div>
    );
  }
}

export function Orbit({ size, style, children }: { size: string; style?: any; children?: React.ReactNode }) {
  const theme = React.useContext(ThemeContext);
  const borderColor = theme.isDark ? '#343B40' : '#E9EDF2';

  style['border'] = '2px solid ' + borderColor;
  style['position'] = 'absolute';
  return (
    <Circle size={size} style={style}>
      {children}
    </Circle>
  );
}
