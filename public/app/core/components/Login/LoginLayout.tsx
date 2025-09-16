import { cx, css, keyframes } from '@emotion/css';
import { useEffect, useState } from 'react';
import * as React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { Branding } from '../Branding/Branding';
import { BrandingSettings } from '../Branding/types';
//import { Footer } from '../Footer/Footer';

interface InnerBoxProps {
  enterAnimation?: boolean;
}

export const InnerBox = ({ children, enterAnimation = true }: React.PropsWithChildren<InnerBoxProps>) => {
  const loginStyles = useStyles2(getLoginStyles);
  return <div className={cx(loginStyles.loginInnerBox, enterAnimation && loginStyles.enterAnimation)}>{children}</div>;
};

export interface LoginLayoutProps {
  /** Custom branding settings that can be used e.g. for previewing the Login page changes */
  branding?: BrandingSettings;
  isChangingPassword?: boolean;
}

export const LoginLayout = ({ children, branding, isChangingPassword }: React.PropsWithChildren<LoginLayoutProps>) => {
  const loginStyles = useStyles2(getLoginStyles);
  const [startAnim, setStartAnim] = useState(false);
  const subTitle = branding?.loginSubtitle ?? "Cibersegurança e monitoramento.";
  const loginBoxBackground = branding?.loginBoxBackground || loginStyles.customLoginBoxBackground;
  const loginLogo = branding?.loginLogo;
  //const hideEdition = branding?.hideEdition ?? Branding.HideEdition;

  useEffect(() => setStartAnim(true), []);

  return (
    <div className={cx(loginStyles.container, startAnim && loginStyles.loginAnim, branding?.loginBackground)}>
      {/* Background SVG Effect */}
      <div className={loginStyles.backgroundEffect}></div>
      
      <div className={loginStyles.loginMain}>
        <div className={cx(loginStyles.loginContent, loginBoxBackground, 'login-content-box')}>
          
          {/* Logo and Title Section */}
          <div className={loginStyles.titleSection}>
            <div className={loginStyles.logoContainer}>
              <Branding.LoginLogo className={loginStyles.loginLogo} logo={loginLogo} />
            </div>
            <div className={loginStyles.titleWrapper}>
              {isChangingPassword ? (
                <h1 className={loginStyles.mainTitle}>
                  <Trans i18nKey="login.layout.update-password">Update your password</Trans>
                </h1>
              ) : (
                <>
                  <div className={loginStyles.brandName}></div>
                  <h1 className={loginStyles.mainTitle}>SentinelArk</h1>
                  <h2 className={loginStyles.dashboardTitle}>Dashboards</h2>
                  {subTitle && <h4 className={loginStyles.subTitle}>{subTitle}</h4>}
                </>
              )}
            </div>
          </div>

          {/* Login Form Container */}
          <div className={loginStyles.loginFormContainer}>
            <div className={loginStyles.loginOuterBox}>{children}</div>
          </div>
        </div>
      </div>
      
     
     {/* {branding?.hideFooter ? <></> : (
  <div className={loginStyles.customFooter}>
    <Footer hideEdition={hideEdition} customLinks={branding?.footerLinks} />
  </div>
)} */}
    </div>
  );
};

const gentleFloat = keyframes`
  0%, 100% {
    transform: translateY(-50%) translateX(0px);
  }
  20% {
    transform: translateY(-52%) translateX(3px);
  }
  40% {
    transform: translateY(-48%) translateX(-2px);
  }
  60% {
    transform: translateY(-51%) translateX(4px);
  }
  80% {
    transform: translateY(-49%) translateX(-1px);
  }
`;

const flyInAnimation = keyframes`
  from {
    opacity: 0;
    transform: translate(-60px, 0px);
  }
  to {
    opacity: 1;
    transform: translate(0px, 0px);
  }
`;

const fadeInAnimation = keyframes`
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
`;

export const getLoginStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1f2937 0%, #000000 50%, #374151 100%)',
      fontFamily: '"Nunito", system-ui, -apple-system, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      position: 'relative',
      overflow: 'hidden',

      // Hide top navigation bar
      '& .sidemenu': {
        display: 'none !important',
      },
      '& [data-testid="sidemenu"]': {
        display: 'none !important',
      },
      '& .navbar': {
        display: 'none !important',
      },
      '& .grafana-app': {
        '& > div:first-child': {
          display: 'none !important',
        },
      },
      // Hide any top header/navigation elements
      '& .page-header': {
        display: 'none !important',
      },
      '& .top-nav': {
        display: 'none !important',
      },
      '& .main-view': {
        paddingTop: '0 !important',
      },
    }),

    backgroundEffect: css({
      position: 'fixed',
      width: '600px',
      height: '600px',
      top: '50%',
      left: '50px',
      transform: 'translateY(-50%)',
      opacity: 0.15,
      zIndex: 1,
      background: `radial-gradient(circle, rgba(16, 185, 129, 0.3) 0%, transparent 70%)`,
      animation: `${gentleFloat} 15s ease-in-out infinite`,
      
      [theme.breakpoints.down('sm')]: {
        width: '400px',
        height: '400px',
        left: '30px',
      },
    }),

    loginMain: css({
      flexGrow: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      maxWidth: '28rem',
      position: 'relative',
      zIndex: 10,
    }),

    loginAnim: css({
      ['.login-content-box']: {
        opacity: 1,
      },
    }),

    titleSection: css({
      textAlign: 'center',
      marginBottom: '2.5rem',
      animation: `${fadeInAnimation} 0.8s ease-out`,
    }),

    logoContainer: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '1rem',
    }),

    loginLogo: css({
      width: '120px',
      height: '120px',
      borderRadius: '8px',
      objectFit: 'cover',
    }),

    titleWrapper: css({
      textAlign: 'center',
    }),

    brandName: css({
      fontSize: '2.5rem',
      fontWeight: 600,
      color: 'white',
      letterSpacing: '-0.025em',
      lineHeight: 1.2,
      marginBottom: '0.5rem',
      
      [theme.breakpoints.down('sm')]: {
        fontSize: '2rem',
      },
    }),

    mainTitle: css({
      fontSize: '3.5rem',
      fontWeight: 700,
      color: '#10b981',
      letterSpacing: '-0.025em',
      lineHeight: 1.2,
      marginBottom: '0.5rem',
      
      [theme.breakpoints.down('sm')]: {
        fontSize: '2.8rem',
      },
    }),

    dashboardTitle: css({
  fontSize: '1.2rem',
  fontWeight: 400,
  color: '#9ca3af',
  letterSpacing: '0.1em',
  marginTop: '-0.5rem',
}),

    subTitle: css({
      fontSize: '1rem',
      fontWeight: 300,
      color: '#d1d5db',
      letterSpacing: '0.025em',
      textAlign: 'center',
      marginTop: '0.5rem',
      
      [theme.breakpoints.down('sm')]: {
        fontSize: '0.9rem',
      },
    }),

    loginContent: css({
      width: '100%',
      display: 'flex',
      alignItems: 'stretch',
      flexDirection: 'column',
      position: 'relative',
      justifyContent: 'flex-start',
      zIndex: 1,
      opacity: 0,
      [theme.transitions.handleMotion('no-preference', 'reduce')]: {
        transition: 'opacity 0.5s ease-in-out',
      },
    }),

    loginFormContainer: css({
      width: '100%',
      maxWidth: '24rem',
      margin: '0 auto',

      
      'button[type="submit"]': {
        background: 'linear-gradient(90deg, #10b981, #059669)',
        color: 'white',
        border: 'none',
        borderRadius: '0.5rem',
        width: '100%',
        padding: '0.75rem 1.5rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        '&:hover': {
          background: 'linear-gradient(90deg, #059669, #047857)',
          transform: 'scale(1.02)',
        },
        '&:disabled': {
          opacity: 0.5,
          cursor: 'not-allowed',
        },
      },

    }),

    customLoginBoxBackground: css({
      background: 'rgba(31, 41, 55, 0.5)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(75, 85, 99, 0.5)',
      borderRadius: '1rem',
      padding: '1.5rem',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    }),

    loginOuterBox: css({
      display: 'flex',
      overflowY: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    }),

    loginInnerBox: css({
      padding: theme.spacing(0, 2, 2, 2),
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flexGrow: 1,
      width: '100%',
      transform: 'translate(0px, 0px)',
      [theme.transitions.handleMotion('no-preference')]: {
        transition: '0.25s ease',
      },
    }),

    enterAnimation: css({
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${flyInAnimation} ease-out 0.4s`,
      },
    }),

    customFooter: css({
      textAlign: 'center',
      marginTop: '1.5rem',
      color: '#6b7280',
      fontSize: '0.75rem',
      position: 'relative',
      zIndex: 10,
    }),

    submitButton: css({
      justifyContent: 'center',
      width: '100%',
      padding: '0.75rem 1.5rem',
      background: 'linear-gradient(90deg, #10b981, #059669)',
      color: 'white',
      border: 'none',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',

      '&:hover': {
        background: 'linear-gradient(90deg, #059669, #047857)',
        transform: 'scale(1.02)',
        boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.25)',
      },

      '&:focus': {
        outline: 'none',
        boxShadow: '0 0 0 2px rgba(16, 185, 129, 0.5)',
      },

      '&:disabled': {
        opacity: 0.5,
        cursor: 'not-allowed',
        transform: 'none',
      },
    }),
  };
};