import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';
import { keyframes } from '@emotion/core';
import { stylesFactory } from '@grafana/ui';

const flyInAnimation = keyframes`
from{
  transform: translate(0px, -320px);
}

to{
  transform: translate(0px, 0px);
}`;

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  let boxBackground = theme.isLight ? 'rgba(6, 30, 200, 0.1 )' : 'rgba(18, 28, 41, 0.65)';

  return {
    divider: {
      base: css`
        float: left;
        width: 100%;
        margin: 0 25% ${theme.spacing.md} 25%;
        display: flex;
        justify-content: space-between;
        text-align: center;
        color: ${theme.colors.text};
      `,
      line: css`
        width: 100px;
        height: 10px;
        border-bottom: 1px solid ${theme.colors.text};
      `,
    },
    loginLogo: css`
      width: 100%;
      max-width: 250px;
      margin-bottom: 15px;
    `,
    loginLogoWrapper: css`
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      padding: ${theme.spacing.lg};
    `,
    titleWrapper: css`
      text-align: center;
    `,
    mainTitle: css`
      font-size: '32px';
    `,
    subTitle: css`
      font-size: ${theme.typography.size.md};
    `,
    loginContent: css`
      max-width: 550px;
      width: 100%;
      display: flex;
      align-items: stretch;
      flex-direction: column;
      position: relative;
      justify-content: center;
      z-index: 1;
      min-height: 320px;
      border-radius: 3px;
      background: ${boxBackground};
    `,
    loginOuterBox: css`
      display: flex;
      overflow-y: hidden;
      align-items: center;
      justify-content: center;
    `,
    loginInnerBox: css`
      padding: ${theme.spacing.xl};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-grow: 1;
      max-width: 415px;
      width: 100%;
      transform: translate(0px, 0px);
      transition: 0.25s ease;

      &.hidden {
        display: none;
      }

      &-enter {
        transform: translate(0px, 320px);
        display: flex;
      }

      &-enter-active {
        transform: translate(0px, 0px);
      }
    `,
    enterAnimation: css`
      animation: ${flyInAnimation} ease-out 0.4s;
    `,
  };
});
