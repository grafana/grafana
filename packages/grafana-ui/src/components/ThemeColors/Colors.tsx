import React from 'react';
import { css, cx } from 'emotion';
import darkTheme from '../../themes/dark';
import lightTheme from '../../themes/light';
import { useStyles } from '../../themes';

export const Colors = () => {
  const styles = useStyles(getStyles);
  const renderColors = (color: any) => {
    return Object.entries(color)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, color]: [string, any]) => {
        return (
          <div key={name} className={styles.wrapper}>
            <span className={styles.name}>
              {name} ({color})
            </span>
            <span
              className={cx(
                styles.color,
                css`
                  background: ${color};
                `
              )}
            />
          </div>
        );
      });
  };

  return (
    <div className={styles.container}>
      <div>
        <h2>Light theme</h2>
        <h3 className={styles.subheader}>Palette</h3>
        {renderColors(lightTheme.palette)}
        <h3 className={styles.subheader}>Colors</h3>
        {renderColors(lightTheme.colors)}
      </div>

      <div>
        <h2>Dark theme</h2>
        <h3 className={styles.subheader}>Palette</h3>
        {renderColors(darkTheme.palette)}
        <h3 className={styles.subheader}>Colors</h3>
        {renderColors(darkTheme.colors)}
      </div>
    </div>
  );
};

const getStyles = () => {
  return {
    subheader: css`
      margin: 20px 0;
    `,
    container: css`
      display: flex;
      justify-content: space-around;
      width: 100%;
    `,
    wrapper: css`
      display: flex;
      align-items: center;
    `,
    name: css`
      width: 250px;
    `,
    color: css`
      display: inline-block;
      width: 50px;
      height: 50px;
    `,
  };
};
